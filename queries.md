# Detection Queries

All detection logic lives in `backend/services/detection.js` and runs against the Neo4j graph.
Each detector returns a list of flagged wallets with their `riskType` so the frontend can label them distinctly.

---

## 1. Circular Transfers

**Risk type:** `circular`

Finds wallets that are the start **and** end of a transfer chain — money that eventually loops back to its origin, a classic layering pattern.

```cypher
MATCH path = (w:Wallet)-[:TRANSFER*2..6]->(w)
WITH w, path, length(path) AS depth
ORDER BY depth ASC
LIMIT toInteger($limit)
RETURN
  w.address                                                      AS address,
  depth,
  [n IN nodes(path)         | n.address]                        AS cycle,
  [r IN relationships(path) | {amount: r.amount, coin: r.coin_type, txid: r.txid}] AS transfers
```

**How it works:**
- `[:TRANSFER*2..6]` matches chains of 2 – 6 hops that start and end at the same wallet.
- A 2-hop cycle is A → B → A (ping-pong); a 6-hop cycle is money routed through five intermediaries before returning.
- Results are sorted shortest-cycle-first so the most obvious loops surface at the top.

**Returned fields:** `address`, `depth` (cycle length), `cycle` (ordered list of wallet addresses), `transfers` (amount / coin / txid per hop).

---

## 2. High Fan-Out

**Risk type:** `fanout`

Finds wallets that send money to an unusually large number of distinct recipients — indicative of a distribution hub, peel-chain, or automated scattering.

```cypher
MATCH (w:Wallet)-[t:TRANSFER]->()
WITH w, count(t) AS outDegree, sum(t.amount) AS totalSent
WHERE outDegree >= toInteger($threshold)
RETURN w.address AS address, outDegree, totalSent
ORDER BY outDegree DESC
LIMIT toInteger($limit)
```

**How it works:**
- Counts every outgoing `TRANSFER` edge from each wallet.
- Filters to wallets above the `threshold` (default 5).
- Sorted by `outDegree` descending so the biggest hubs appear first.

**Returned fields:** `address`, `outDegree`, `totalSent`.

---

## 3. High Fan-In

**Risk type:** `fanin`

Finds wallets that receive from an unusually large number of distinct senders — indicative of a consolidation sink, collection address, or exchange deposit wallet used for aggregation.

```cypher
MATCH ()-[t:TRANSFER]->(w:Wallet)
WITH w, count(t) AS inDegree, sum(t.amount) AS totalReceived
WHERE inDegree >= toInteger($threshold)
RETURN w.address AS address, inDegree, totalReceived
ORDER BY inDegree DESC
LIMIT toInteger($limit)
```

**How it works:**
- Mirror of High Fan-Out but counts incoming edges instead.
- Same `threshold` parameter (default 5).

**Returned fields:** `address`, `inDegree`, `totalReceived`.

---

## 4. Rapid Transfers

**Risk type:** `rapid`

Finds three-wallet chains (A → B → C) where the second transfer happens within a short time window of the first — a pattern consistent with funds quickly being passed on before they can be traced.

```cypher
MATCH (a:Wallet)-[t1:TRANSFER]->(b:Wallet)-[t2:TRANSFER]->(c:Wallet)
WHERE a <> c
  AND toInteger(t2.timestamp) - toInteger(t1.timestamp) >= 0
  AND toInteger(t2.timestamp) - toInteger(t1.timestamp) <= toInteger($windowSeconds)
RETURN
  a.address  AS from,
  b.address  AS via,
  c.address  AS to,
  t1.amount  AS amount1, t2.amount AS amount2,
  t1.timestamp AS ts1,   t2.timestamp AS ts2,
  t1.txid    AS txid1,   t2.txid   AS txid2
LIMIT toInteger($limit)
```

**How it works:**
- Matches a 2-hop path A → B → C.
- `a <> c` excludes exact ping-pong pairs (covered by the circular detector).
- The time difference check uses integer-cast timestamps. `$windowSeconds` defaults to 60 s.

**Returned fields:** `from`, `via`, `to`, `amount1`, `amount2`, `ts1`, `ts2`.

---

## 5. Dense Clusters

**Risk type:** `cluster`

Finds wallets that are highly connected in **both** directions — high in-degree **and** high out-degree simultaneously. These are central nodes in tight transaction clusters and may represent mixers or coordinating accounts.

```cypher
MATCH (w:Wallet)
OPTIONAL MATCH (w)-[out:TRANSFER]->()
WITH w, count(out) AS outDeg
OPTIONAL MATCH ()-[inr:TRANSFER]->(w)
WITH w, outDeg, count(inr) AS inDeg
WHERE outDeg >= toInteger($threshold) AND inDeg >= toInteger($threshold)
RETURN w.address AS address, outDeg, inDeg, (outDeg + inDeg) AS totalDeg
ORDER BY totalDeg DESC
LIMIT toInteger($limit)
```

**How it works:**
- Uses two `OPTIONAL MATCH` passes to separately count out and in edges (a single `MATCH` would produce a cartesian product).
- Both `outDeg` and `inDeg` must exceed `threshold` (default 3) — a wallet that only sends a lot is a hub, not a cluster center.
- Sorted by total degree so the densest nodes appear first.

**Returned fields:** `address`, `outDegree`, `inDegree`, `totalDegree`.

---

## 6. Risk Score (single wallet)

Computes a composite 0 – 100 risk score for one wallet based on three structural factors.

```cypher
MATCH (w:Wallet {address: $address})
OPTIONAL MATCH (w)-[out:TRANSFER]->()
WITH w, count(out) AS outDeg
OPTIONAL MATCH ()-[inr:TRANSFER]->(w)
WITH w, outDeg, count(inr) AS inDeg
OPTIONAL MATCH path = (w)-[:TRANSFER*2..4]->(w)
WITH w, outDeg, inDeg, count(path) AS cycles
RETURN outDeg, inDeg, cycles
```

**Scoring formula:**

| Factor | Max contribution | Formula |
|---|---|---|
| Fan-out | 25 | `min(25, outDeg × 5)` |
| Fan-in | 25 | `min(25, inDeg × 5)` |
| Cycle involvement | 30 | `min(30, cycles × 15)` |
| Total degree | 20 | `min(20, (outDeg + inDeg) × 2)` |
| **Total** | **100** | capped at 100 |

Cycle involvement is weighted most heavily (30 pts) because circular transfers are the strongest indicator of deliberate obfuscation.

---

## 7. Bulk Risk Scores (multiple wallets)

Same scoring logic as above but computed for many addresses in a single round-trip using `UNWIND`, avoiding N+1 queries.

```cypher
UNWIND $addresses AS addr
MATCH (w:Wallet {address: addr})
OPTIONAL MATCH (w)-[out:TRANSFER]->()
WITH w, addr, count(out) AS outDeg
OPTIONAL MATCH ()-[inr:TRANSFER]->(w)
WITH w, addr, outDeg, count(inr) AS inDeg
OPTIONAL MATCH p = (w)-[:TRANSFER*2..4]->(w)
WITH addr, outDeg, inDeg, count(p) AS cycles
WITH addr, outDeg, inDeg, cycles,
  CASE WHEN outDeg * 5 < 25        THEN outDeg * 5        ELSE 25 END AS foScore,
  CASE WHEN inDeg * 5 < 25         THEN inDeg * 5         ELSE 25 END AS fiScore,
  CASE WHEN cycles * 15 < 30       THEN cycles * 15       ELSE 30 END AS cycleScore,
  CASE WHEN (outDeg + inDeg) * 2 < 20 THEN (outDeg + inDeg) * 2 ELSE 20 END AS degScore
WITH addr, foScore + fiScore + cycleScore + degScore AS rawScore
RETURN addr,
       CASE WHEN rawScore < 100 THEN rawScore ELSE 100 END AS score
```

The `CASE WHEN … ELSE` pattern replicates `min()` inside Cypher arithmetic so the entire scoring pipeline runs in the database without a round-trip per wallet.

---

## 8. Community Detection (client-side Louvain)

Community detection does **not** run as a Cypher query — it runs in JavaScript on the subgraph already fetched from the `/graph` endpoint, so it requires no Neo4j GDS plugin.

**Algorithm:** Louvain modularity optimisation — iteratively moves each node to the neighbouring community that produces the greatest modularity gain $\Delta Q$:

$$\Delta Q = \frac{w_{i \to C}}{2m} - \frac{k_C \cdot k_i}{(2m)^2} \cdot 2$$

where $w_{i \to C}$ is the edge weight from node $i$ to community $C$, $k_i$ is the weighted degree of $i$, $k_C$ is the sum of degrees in $C$, and $m$ is the total graph weight.

**Complexity:** $O(E \times \text{iterations})$ — suitable for the ≤ 1 000-node subgraphs served by the backend.

The resulting `Map<nodeId, clusterId>` is used by the frontend to colour nodes by community.

---

## Detection API Endpoints

| Method | Path | Parameters | Description |
|---|---|---|---|
| `GET` | `/suspicious` | `type`, `threshold`, `limit`, `windowSeconds` | Run one detector, returns flagged wallets |
| `GET` | `/stats` | — | Aggregate graph statistics |
| `GET` | `/graph` | `addresses`, `depth` | Ego-subgraph with bulk risk scores |
| `GET` | `/wallet/:address` | — | Single wallet details including risk score |

`type` values for `/suspicious`: `circular`, `fanout`, `fanin`, `rapid`, `cluster`.
