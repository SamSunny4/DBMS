# Neo4j Database Schema

## Nodes

### `Wallet`
Represents a cryptocurrency wallet address.

| Property | Type | Notes |
|---|---|---|
| `address` | `String` | **Unique** — primary identifier |

---

### `Coin`
Represents a cryptocurrency type (e.g. BTC, ETH).

| Property | Type | Notes |
|---|---|---|
| `name` | `String` | **Unique** — e.g. `"ETH"`, `"BTC"` |

---

### `User`
Represents an application user account.

| Property | Type | Notes |
|---|---|---|
| `username` | `String` | **Unique** — login name |
| `email` | `String` | **Unique** |
| `password_hash` | `String` | bcrypt hash |
| `role` | `String` | `"admin"` or `"user"` |
| `created_at` | `String` | ISO 8601 timestamp |
| `is_banned` | `Boolean` | `true` if account is suspended |
| `preferences` | `String` | JSON-serialised viz settings (optional) |

---

## Relationships

### `TRANSFER` — `(Wallet)-[:TRANSFER]->(Wallet)`
Represents a single on-chain transaction from one wallet to another.

| Property | Type | Notes |
|---|---|---|
| `txid` | `String` | **Unique per edge** — transaction ID / hash |
| `amount` | `Float` | Value transferred (in the coin's base unit, ETH for BigQuery data) |
| `value_lossless` | `String` | Raw Wei string (BigQuery imports) — preserved to avoid float precision loss |
| `timestamp` | `String` | ISO 8601 timestamp of the block |
| `coin_type` | `String` | e.g. `"ETH"`, `"BTC"` |

---

### `USES` — `(Wallet)-[:USES]->(Coin)`
Connects a wallet to the coin type(s) it has participated in transactions with.
No properties.

---

## Constraints

| Name | Target | Rule |
|---|---|---|
| `wallet_address` | `Wallet.address` | IS UNIQUE |
| `coin_name` | `Coin.name` | IS UNIQUE |
| `user_username` | `User.username` | IS UNIQUE |
| `user_email` | `User.email` | IS UNIQUE |

---

## Indexes

| Name | Target | Purpose |
|---|---|---|
| `transfer_timestamp` | `TRANSFER.timestamp` | Fast time-range filtering |
| `transfer_txid` | `TRANSFER.txid` | Fast lookup by transaction hash |
| `user_created_at` | `User.created_at` | Sorting/filtering users by registration date |

---

## Ingestion Cypher

Transactions are written in batches of 1 000 using `MERGE` to guarantee idempotency — re-uploading the same file will not create duplicate nodes or edges.

```cypher
UNWIND $transactions AS tx
MERGE (from:Wallet {address: tx.wallet_from})
MERGE (to:Wallet   {address: tx.wallet_to})
MERGE (c:Coin      {name: tx.coin_type})
MERGE (from)-[:USES]->(c)
MERGE (to)-[:USES]->(c)
MERGE (from)-[t:TRANSFER {txid: tx.transaction_id}]->(to)
ON CREATE SET
  t.amount         = toFloat(tx.amount),
  t.value_lossless = tx.value_lossless,
  t.timestamp      = tx.timestamp,
  t.coin_type      = tx.coin_type
RETURN count(*) AS created
```

---

## Supported Input Formats

### Internal CSV
Must contain these columns (case-insensitive, whitespace-trimmed):

```
wallet_from, wallet_to, amount, timestamp, coin_type, transaction_id
```

### BigQuery Ethereum Export
Auto-detected when the file contains `transaction_hash`, `from_address`, and `block_timestamp`.
`value` (raw Wei) is divided by `1e18` to produce ETH. `block_timestamp` accepts either a Unix epoch integer or an ISO string.

```
transaction_hash, from_address, to_address, block_timestamp, value [, value_lossless]
```

---

## Entity-Relationship Diagram

```
(User)

(Wallet) -[:TRANSFER {txid, amount, timestamp, coin_type}]-> (Wallet)
(Wallet) -[:USES]-> (Coin)
```

Multiple wallets may use the same coin. A wallet can both send and receive transfers, forming a directed multigraph.
