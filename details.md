# System Details — Graph Plotting, Calculations & Risk Identification

This document explains how the blockchain transaction graph is constructed, visualised (2D & 3D), laid out with physics simulations, and how risk identification and scoring work end-to-end.

---

## Table of Contents

1. [Data Pipeline Overview](#1-data-pipeline-overview)
2. [Graph Data Model (Neo4j)](#2-graph-data-model-neo4j)
3. [Graph Construction & Transformation](#3-graph-construction--transformation)
4. [2D Graph Plotting (Cytoscape.js)](#4-2d-graph-plotting-cytoscapejs)
5. [3D Graph Plotting (3d-force-graph / Three.js)](#5-3d-graph-plotting-3d-force-graph--threejs)
6. [Force-Directed Layout Calculations](#6-force-directed-layout-calculations)
7. [Coordinate Mapping & the Z-Axis (Log-Scaled Volume)](#7-coordinate-mapping--the-z-axis-log-scaled-volume)
8. [Node Rendering & Color Calculations](#8-node-rendering--color-calculations)
9. [Community Detection (Louvain)](#9-community-detection-louvain)
10. [Risk Identification System](#10-risk-identification-system)
11. [Risk Score Calculation](#11-risk-score-calculation)
12. [Path Finding](#12-path-finding)
13. [Filtering & Thresholds](#13-filtering--thresholds)
14. [Temporal Animation](#14-temporal-animation)
15. [Performance Considerations](#15-performance-considerations)

---

## 1. Data Pipeline Overview

```
CSV Upload → Parser → Validation → Neo4j Ingestion → Graph Query → Transform → Visualise
```

### Step-by-step flow:

1. **Upload**: User uploads a CSV/JSON file via `/upload-transactions`.
2. **Parse**: `parser.js` detects schema (standard or BigQuery Ethereum format), normalizes fields.
3. **Validate**: Required fields checked (`wallet_from`, `wallet_to`, `amount`, `timestamp`, `coin_type`, `transaction_id`). Invalid rows are skipped with error messages.
4. **Ingest**: `ingestion.js` batches transactions (1000/batch) into Neo4j using `MERGE` queries, creating `Wallet` nodes, `Coin` nodes, and `TRANSFER` relationships.
5. **Query**: The `/graph` endpoint runs Cypher queries to fetch a subgraph.
6. **Transform**: `graph-transform.js` converts Neo4j records into a frontend-consumable format.
7. **Enrich**: Risk scores, log-scaled volume, Louvain community IDs, and temporal normalization are computed and attached to nodes/edges.
8. **Render**: The frontend renders nodes/edges in either 2D (Cytoscape.js) or 3D (3d-force-graph).

### BigQuery Ethereum normalization:

For Ethereum BigQuery data, the parser performs:
- `value` (Wei) → `amount` (ETH): divides by `1e18`
- `value_lossless` is preserved as the raw Wei string for precision
- `from_address` / `to_address` → `wallet_from` / `wallet_to`
- `transaction_hash` → `transaction_id`
- `block_timestamp` converted from Unix epoch or ISO strings

---

## 2. Graph Data Model (Neo4j)

### Node types:

| Label    | Key Property | Description                           |
|----------|-------------|---------------------------------------|
| `Wallet` | `address`   | A blockchain wallet address           |
| `Coin`   | `name`      | A cryptocurrency type (e.g. ETH, BTC) |

### Relationship types:

| Type       | From     | To       | Properties                                           |
|-----------|----------|----------|------------------------------------------------------|
| `TRANSFER` | `Wallet` | `Wallet` | `txid`, `amount`, `value_lossless`, `timestamp`, `coin_type` |
| `USES`     | `Wallet` | `Coin`   | _(none)_                                             |

### Indexes & constraints:

```cypher
CREATE CONSTRAINT wallet_address IF NOT EXISTS FOR (w:Wallet) REQUIRE w.address IS UNIQUE
CREATE CONSTRAINT coin_name IF NOT EXISTS FOR (c:Coin) REQUIRE c.name IS UNIQUE
CREATE INDEX transfer_timestamp IF NOT EXISTS FOR ()-[t:TRANSFER]-() ON (t.timestamp)
CREATE INDEX transfer_txid IF NOT EXISTS FOR ()-[t:TRANSFER]-() ON (t.txid)
```

---

## 3. Graph Construction & Transformation

### Neo4j → Frontend format

The `neo4jToCytoscape()` function in `graph-transform.js` converts raw Neo4j records into this structure:

```json
{
  "nodes": [
    {
      "data": {
        "id": "42",
        "label": "0x4838b106...",
        "nodeType": "Wallet",
        "address": "0x4838b106...",
        "riskScore": 35,
        "value_lossless": 5384456862740267
      }
    }
  ],
  "edges": [
    {
      "data": {
        "id": "e1",
        "source": "42",
        "target": "43",
        "edgeType": "TRANSFER",
        "amount": 0.00538,
        "value_lossless": "5384456862740267",
        "coin_type": "ETH",
        "label": "0.00538 ETH"
      }
    }
  ]
}
```

### Processing logic:

1. **Deduplication**: Uses `Map` keyed by Neo4j internal identity — nodes and edges are only added once.
2. **Path unwinding**: Neo4j paths are split into segments; each segment's start/end nodes and relationship are extracted.
3. **Property conversion**: Neo4j Integer objects (which can exceed JS `Number.MAX_SAFE_INTEGER`) are converted via `.toNumber()`.

### Per-node volume aggregation & log normalization (graph route):

After the transform, the graph route computes a per-node transaction volume and then applies log-scaling with min-max normalization:

```javascript
// 1. Sum value_lossless from all adjacent edges
for (const edge of elements.edges) {
  const val = parseFloat(edge.data.value_lossless || edge.data.amount || 0);
  nodeVolume.set(edge.data.source, (nodeVolume.get(edge.data.source) || 0) + val);
  nodeVolume.set(edge.data.target, (nodeVolume.get(edge.data.target) || 0) + val);
}

// 2. Log-scale: log_volume = log10(total_volume + 1)
// 3. Min-max normalize to [0, 1]
const logRange = logMax - logMin || 1;
normalized = (logVol - logMin) / logRange;
```

Each node receives these enriched properties:

| Property | Source | Description |
|----------|--------|-------------|
| `totalVolume` | Sum of all adjacent edges | Raw total transaction volume |
| `logVolume` | `log10(totalVolume + 1)` | Log-scaled volume |
| `normalizedVolume` | Min-max normalization of logVolume | 0 to 1 — used for Z-axis, glow, threshold |

### Edge enrichments:

```javascript
edge.data.logAmount = Math.log10(amount + 1);       // log-scaled edge width
edge.data.normalizedTime = (ts - tsMin) / tsRange;  // 0..1 temporal position
```

### Louvain community assignment:

After volume computation, the route runs in-memory Louvain community detection (`detectCommunities(elements)`) and attaches a `clusterId` to each node. See [Section 9](#9-community-detection-louvain).

---

## 4. 2D Graph Plotting (Cytoscape.js)

### Library: Cytoscape.js with the Cola layout extension

The 2D graph uses Cytoscape.js (`cytoscape` + `cytoscape-cola`).

### Layout: Cola (Constraint-based Layout)

The Cola layout is a force-directed algorithm that computes node positions by simulating physical forces:

```javascript
{
  name: "cola",
  animate: true,
  maxSimulationTime: 500,   // Stop after 500ms
  nodeSpacing: 40,           // Minimum pixels between nodes
  edgeLength: 120,           // Preferred edge length
  randomize: true,           // Random initial positions
  avoidOverlap: true,        // Prevent node overlap
}
```

**How Cola works:**
- **Repulsion force**: Nodes push each other apart (like charged particles)
- **Edge spring force**: Connected nodes are pulled together (spring constant)
- **Constraint satisfaction**: Prevents overlaps while respecting spacing
- **Iterative refinement**: Runs until energy is minimized or time limit

### Node styling:

| Node Type | Shape   | Size | Color Logic                        |
|-----------|---------|------|------------------------------------|
| Wallet    | Circle  | 30px | `riskScore` → HSL gradient (green→red) |
| Coin      | Diamond | 22px | Fixed amber (`#f59e0b`)            |

The risk-to-color mapping:

```javascript
function riskColor(score) {
  const hue = Math.round(120 * (1 - score / 100));
  // score=0  → hue=120 (green)
  // score=50 → hue=60  (yellow)
  // score=100→ hue=0   (red)
  return `hsl(${hue}, 90%, 50%)`;
}
```

### Edge styling:

| Edge Type   | Style   | Arrow          | Label          |
|------------|---------|----------------|----------------|
| TRANSFER   | Solid   | Triangle arrow | `amount coin`  |
| USES       | Dashed  | None           | _(none)_       |
| Highlighted| Solid   | Triangle arrow | Same, amber    |

### Interaction:

- **Click**: Navigates to `/wallet/[address]` for wallet nodes
- **Zoom**: Custom wheel handler with configurable zoom speed
- **Pan/Drag**: Built-in Cytoscape controls

---

## 5. 3D Graph Plotting (3d-force-graph / Three.js)

### Library stack:

```
3d-force-graph → Three.js (WebGL) → d3-force-3d (physics)
```

### Data conversion (Cytoscape format → 3d-force-graph format):

The `GraphViewer3D` component converts the backend's Cytoscape-format data:

```
Cytoscape nodes  → { id, label, color, fz, nodeSize, glowIntensity, ... }
Cytoscape edges  → { source, target, color, width, normalizedTime, ... }
```

### Dimensional mapping summary:

| Dimension | Data Source | Encoding |
|-----------|-------------|----------|
| X, Y | Force-directed layout (d3-force-3d) | Network topology |
| Z | `normalizedVolume` | `fz = normalizedVolume × 300 − 150` |
| Node size | `totalVolume` | `3 + √(totalVolume) / scaleFactor` |
| Node color | `riskScore` or `clusterId` | HSL gradient or golden-angle hue |
| Edge width | `logAmount` | `logAmount × edgeWidthScale` (max ≈ 4) |
| Glow intensity | `normalizedVolume` | Sprite alpha proportional to 0..1 |

### Node rendering:

Each node is a Three.js `Group` containing:

1. **Core sphere**: `SphereGeometry(nodeSize × 0.5, 16, 16)` with `MeshBasicMaterial` — solid colored sphere sized by economic importance (√volume).
2. **Glow sprite**: Canvas-generated radial gradient texture applied to a `Sprite` with `AdditiveBlending`. Intensity is proportional to `normalizedVolume` (0..1), meaning high-volume wallets glow brighter.

```
scaleFactor = √(maxVolume) / 13
nodeSize    = 3 + √(totalVolume) / scaleFactor      →  range: 3 to ~16 units
Glow size   = nodeSize × 2.2                         →  range: 6.6 to ~35 units
Glow alpha  = 0.6 + normalizedVolume × 0.4           →  range: 0.6 to 1.0
```

### Edge rendering:

- Line width: `log10(amount + 1)` scaled so the thickest edge ≈ 4 units
  - `edgeWidthScale = 4 / maxLogAmount`
  - Minimum width: 0.3 for visual visibility
- Normal edges: `rgba(55, 65, 81, 0.35)` — semi-transparent gray
- Path edges: `rgba(245, 158, 11, 0.8)` — amber, width 3, with directional particles
- Overall `linkOpacity(0.6)`

### Camera:

- **OrbitControls** (built into 3d-force-graph): left-drag=rotate, right-drag=pan, scroll=zoom
- Initial camera: positioned at `z=500`, looking at origin, animated over 1000ms

### Color modes:

The UI provides a toggle between two color modes:

1. **Risk mode** (default): `hue = 120 × (1 − riskScore / 100)` → green (safe) → yellow → red (dangerous)
2. **Cluster mode**: Golden-angle spacing `hue = clusterId × 137.508° mod 360` for maximum perceptual separation between communities

Override colors (highest priority first):
- Gold `hsl(45, 100%, 60%)` for path nodes
- Red `hsl(0, 85%, 55%)` for highlighted/suspicious nodes

---

## 6. Force-Directed Layout Calculations

### 2D (Cola algorithm):

The Cola layout minimizes a stress function:

$$\text{stress} = \sum_{i<j} w_{ij} \left( \| p_i - p_j \| - d_{ij} \right)^2$$

Where:
- $p_i, p_j$ are node positions
- $d_{ij}$ is the ideal distance (graph-theoretic shortest path scaled by `edgeLength`)
- $w_{ij} = d_{ij}^{-2}$ are weights

### 3D (d3-force-3d):

The 3D layout uses a Barnes-Hut simulation with these forces:

| Force | Purpose | Configuration |
|-------|---------|---------------|
| `charge` | Many-body repulsion (prevents overlap) | Default d3 many-body |
| `link` | Spring force between connected nodes | Natural spring length |
| `center` | Pulls all nodes toward origin | Keeps graph centered |
| `z` (custom) | Biases Z toward `value_lossless` | `alpha × 0.3` strength |

**Physics parameters:**

```javascript
d3AlphaDecay(0.02)     // How fast simulation cools (lower = longer, smoother)
d3VelocityDecay(0.3)   // Friction / damping (lower = more momentum)
warmupTicks(100)        // Initial ticks before rendering
cooldownTicks(200)      // Maximum ticks before stopping
```

**Alpha decay** controls convergence:

$$\alpha_{t+1} = \alpha_t \times (1 - \text{alphaDecay})$$

The simulation stops when $\alpha < \text{alphaMin}$ (default 0.001).

### Custom Z-force:

The custom Z-force biases each node's Z position toward its log-scaled normalized volume:

```javascript
// fz = normalizedVolume * 300 - 150   (range: -150 to +150)
Graph.d3Force("z", (alpha) => {
  for (const node of graphData.nodes) {
    if (node.fz !== undefined) {
      node.vz += (node.fz - (node.z || 0)) * alpha * 0.3;
    }
  }
});
```

This creates a soft constraint: nodes are pulled toward their target Z (based on log-volume) while still being influenced by repulsion and link forces. Low-volume wallets sink (Z ≈ −150), high-volume wallets rise (Z ≈ +150).

---

## 7. Coordinate Mapping & the Z-Axis (Log-Scaled Volume)

### Volume aggregation & log normalization:

```
totalVolume    = Σ(value_lossless of all adjacent edges)
logVolume      = log₁₀(totalVolume + 1)
normalizedVol  = (logVolume − logMin) / (logMax − logMin)    →  [0, 1]
```

The log transform compresses the extreme range of blockchain transaction volumes (which can span 10+ orders of magnitude) into a perceptually linear scale. Min-max normalization then maps the log values to a 0–1 range.

### Why log-scaling?

Raw volume normalization is dominated by outlier "whale" wallets. For example, if one wallet has 10,000 ETH and the rest have < 1 ETH, linear normalization compresses 99.9% of nodes to near-zero. Log-scaling reveals structure across the full range:

| totalVolume | log₁₀(vol + 1) | Normalized (approx) |
|-------------|----------------|---------------------|
| 0 | 0.00 | 0.0 |
| 1 | 0.30 | ~0.06 |
| 100 | 2.00 | ~0.40 |
| 1,000,000 | 6.00 | ~0.83 |
| 10 billion | 10.00 | 1.0 |

### Axis mapping:

| Axis | Source | Algorithm |
|------|--------|-----------|
| X | Force-directed layout | Computed by d3-force charge + link forces |
| Y | Force-directed layout | Computed by d3-force charge + link forces |
| Z | `normalizedVolume` | `fz = normalizedVolume × 300 − 150` → range [−150, +150] |

Low-volume wallets sink to the bottom (Z ≈ −150), high-volume wallets rise to the top (Z ≈ +150). X and Y positions emerge organically from the physics simulation to reveal network structure.

---

## 8. Node Rendering & Color Calculations

### 3D node size (economic importance):

Node size encodes total transaction volume using a square-root scale:

```javascript
scaleFactor = Math.sqrt(maxTotalVolume) / 13;
nodeSize    = 3 + Math.sqrt(totalVolume) / scaleFactor;
```

The auto-computed `scaleFactor` ensures the largest node is ≈ 16 units, while the smallest (volume = 0) is 3 units. Square-root scaling preserves visual discrimination without letting whale wallets dominate the scene.

| totalVolume | √volume | nodeSize (approx) |
|-------------|---------|-------------------|
| 0 | 0 | 3 |
| 100 | 10 | ~4 |
| 1,000,000 | 1,000 | ~10 |
| max | √max | ~16 |

### 3D color: Risk mode (default):

```javascript
function riskColor(score) {
  const hue = Math.round(120 * (1 - score / 100));
  return `hsl(${hue}, 90%, 55%)`;
}
```

| Risk Score | Hue | Color |
|-----------|-----|-------|
| 0 | 120° | Green (safe) |
| 50 | 60° | Yellow (medium) |
| 100 | 0° | Red (dangerous) |

### 3D color: Cluster mode:

```javascript
function clusterColor(clusterId) {
  const hue = (clusterId * 137.508) % 360;  // golden angle
  return `hsl(${Math.round(hue)}, 70%, 55%)`;
}
```

The golden angle (≈ 137.5°) maximizes perceptual separation between consecutive cluster IDs, preventing adjacent communities from having similar colors.

### Override colors:

| Condition | Color | Priority |
|-----------|-------|----------|
| Path node | `hsl(45, 100%, 60%)` — Gold | Highest |
| Suspicious / Highlighted node | `hsl(0, 85%, 55%)` — Red | High |
| Cluster mode node | `clusterColor(clusterId)` | Medium |
| Risk mode node (default) | `riskColor(riskScore)` | Default |

### 2D color gradient (by riskScore):

Same `riskColor()` function as 3D risk mode:

```javascript
function riskColor(score) {
  const hue = Math.round(120 * (1 - score / 100));
  return `hsl(${hue}, 90%, 50%)`;
}
```

### Glow texture generation:

The glow effect is produced by a canvas-drawn radial gradient with intensity proportional to `normalizedVolume` (0..1):

```
base alpha = 0.6 + normalizedVolume × 0.4    →  range: 0.6 to 1.0

Stop 0.00 → rgba(r,g,b, alpha)          full opacity (core)
Stop 0.25 → rgba(r,g,b, alpha × 0.7)   70%
Stop 0.55 → rgba(r,g,b, alpha × 0.25)  25%
Stop 1.00 → rgba(r,g,b, 0)             fully transparent
```

Combined with `AdditiveBlending` in Three.js, this creates a bloom/glow around each node. High-volume wallets (`normalizedVolume → 1`) glow significantly brighter than low-volume wallets, making economic hotspots visually prominent even before inspecting individual nodes.

### Edge width (log-scaled):

```javascript
edge.logAmount  = Math.log10(amount + 1);            // backend
edgeWidthScale  = 4 / maxLogAmount;                   // frontend auto-scale
visualWidth     = Math.max(0.3, logAmount × edgeWidthScale);  // capped ≈ 4
```

Log-scaling prevents mega-transactions from overwhelming thin edges. The auto-scale factor ensures the thickest edge is ≈ 4 units regardless of the data range.

---

## 9. Community Detection (Louvain)

### Algorithm:

The system uses a Louvain-style community detection algorithm implemented in `services/community.js`. Unlike Neo4j GDS (which requires a separate plugin), this runs entirely in-memory on the already-fetched subgraph.

### How it works:

1. **Build adjacency**: Construct an undirected weighted adjacency list from the subgraph edges. Edge weight = `amount` (defaults to 1).
2. **Initialize**: Each node starts in its own community. Track per-community total degree and internal weight.
3. **Local moves** (up to 20 iterations):
   - For each node $i$, compute the modularity gain $\Delta Q$ of moving $i$ to each neighbouring community $c_j$:

$$\Delta Q = \frac{w_{i \to c_j}}{2m} - \frac{\Sigma_{c_j} \cdot k_i}{2m^2}$$

   Where:
   - $w_{i \to c_j}$ = sum of edge weights from $i$ to nodes in community $c_j$
   - $\Sigma_{c_j}$ = total degree of community $c_j$
   - $k_i$ = degree (weighted) of node $i$
   - $m$ = total edge weight of the graph

   - Move $i$ to the community with the highest positive $\Delta Q$.
   - If no move improves modularity, stay.
4. **Convergence**: Stop when no node moves, or after 20 iterations.
5. **Renumber**: Contiguously renumber communities from 0.

### Complexity:

$O(E \times \text{iterations})$ — bounded by 20 iterations, efficient for subgraphs up to ~1000 nodes.

### Output:

Each node receives a `clusterId` (integer ≥ 0). The response also includes `clusterCount` — the number of distinct communities detected.

### Cluster coloring:

```javascript
function clusterColor(clusterId) {
  const hue = (clusterId * 137.508) % 360;  // golden angle
  return `hsl(${Math.round(hue)}, 70%, 55%)`;
}
```

Both backend (`services/community.js`) and frontend (`GraphViewer3D.js`) implement the same golden-angle color function for consistency.

---

## 10. Risk Identification System

The system detects five types of suspicious activity, all implemented as Cypher queries in `detection.js`:

### 9.1 Circular Transfers

**What it detects**: Funds cycling back to the same wallet through 2–6 hops.

```cypher
MATCH path = (w:Wallet)-[:TRANSFER*2..6]->(w)
```

**Why it matters**: Circular fund flows are a hallmark of money laundering (layering phase) — funds are moved through intermediaries to obscure the trail.

**Returns**: The wallet, cycle depth, list of addresses in the cycle, and transfer details.

### 9.2 High Fan-Out

**What it detects**: Wallets that send funds to many different recipients.

```cypher
MATCH (w:Wallet)-[t:TRANSFER]->()
WITH w, count(t) AS outDegree, sum(t.amount) AS totalSent
WHERE outDegree >= $threshold
```

**Why it matters**: A wallet distributing funds to many addresses may be a mixing service, tumbler, or distribution point in a fraud scheme.

**Parameters**: `threshold` (default: 5 outgoing transfers)

### 9.3 High Fan-In

**What it detects**: Wallets that receive funds from many different senders.

```cypher
MATCH ()-[t:TRANSFER]->(w:Wallet)
WITH w, count(t) AS inDegree, sum(t.amount) AS totalReceived
WHERE inDegree >= $threshold
```

**Why it matters**: Aggregation points where many small deposits converge may indicate collection wallets in phishing, ransomware, or Ponzi schemes.

**Parameters**: `threshold` (default: 5 incoming transfers)

### 9.4 Rapid Transfers

**What it detects**: A→B→C chains where B forwards funds within a short time window.

```cypher
MATCH (a:Wallet)-[t1:TRANSFER]->(b:Wallet)-[t2:TRANSFER]->(c:Wallet)
WHERE a <> c
  AND toInteger(t2.timestamp) - toInteger(t1.timestamp) >= 0
  AND toInteger(t2.timestamp) - toInteger(t1.timestamp) <= $windowSeconds
```

**Why it matters**: Pass-through wallets that receive and immediately forward funds are characteristic of automated laundering pipelines and mule chains.

**Parameters**: `windowSeconds` (default: 60 seconds)

### 9.5 Dense Clusters

**What it detects**: Wallets with both high fan-in AND high fan-out.

```cypher
MATCH (w:Wallet)
-- count outgoing
-- count incoming
WHERE outDeg >= $threshold AND inDeg >= $threshold
```

**Why it matters**: Wallets that are heavily connected in both directions are potential mixing hubs or central coordination points.

**Parameters**: `threshold` (default: 3 for both directions)

---

## 11. Risk Score Calculation

### Per-wallet scoring formula:

Each wallet receives a composite score from **0 to 100** based on four factors:

| Factor | Formula | Max Contribution |
|--------|---------|-----------------|
| Fan-out | `min(25, outDegree × 5)` | 25 points |
| Fan-in | `min(25, inDegree × 5)` | 25 points |
| Cycle involvement | `min(30, cycleCount × 15)` | 30 points |
| Total degree | `min(20, (outDeg + inDeg) × 2)` | 20 points |

$$\text{riskScore} = \min\Big(100,\; \underbrace{\min(25, 5 \cdot d_{\text{out}})}_{\text{fan-out}} + \underbrace{\min(25, 5 \cdot d_{\text{in}})}_{\text{fan-in}} + \underbrace{\min(30, 15 \cdot c)}_{\text{cycles}} + \underbrace{\min(20, 2 \cdot (d_{\text{out}}+d_{\text{in}}))}_{\text{degree}}\Big)$$

Where:
- $d_{\text{out}}$ = number of outgoing `TRANSFER` edges
- $d_{\text{in}}$ = number of incoming `TRANSFER` edges
- $c$ = number of distinct cycles (paths of length 2–4 returning to the wallet)

### Score interpretation:

| Score Range | Risk Level | Visual Color |
|------------|-----------|--------------|
| 0–20 | Low | Green |
| 21–50 | Medium | Yellow |
| 51–100 | High | Red |

### Bulk scoring:

For the graph view, all visible wallet risk scores are computed in a single Cypher query using `UNWIND $addresses` — this avoids N+1 queries and makes the `/graph` endpoint efficient even with hundreds of nodes.

```cypher
UNWIND $addresses AS addr
MATCH (w:Wallet {address: addr})
OPTIONAL MATCH (w)-[out:TRANSFER]->()
WITH w, addr, count(out) AS outDeg
OPTIONAL MATCH ()-[inr:TRANSFER]->(w)
WITH w, addr, outDeg, count(inr) AS inDeg
OPTIONAL MATCH p = (w)-[:TRANSFER*2..4]->(w)
WITH addr, outDeg, inDeg, count(p) AS cycles
-- ... compute score components with CASE WHEN capping ...
RETURN addr, score
```

---

## 12. Path Finding

### Shortest path between two wallets:

```cypher
MATCH (a:Wallet {address: $from}), (b:Wallet {address: $to})
MATCH path = shortestPath((a)-[:TRANSFER*..10]->(b))
RETURN path
```

- **Algorithm**: Neo4j's built-in `shortestPath()` uses breadth-first search (BFS)
- **Max depth**: 10 hops (prevents runaway queries)
- **Direction**: Follows `TRANSFER` direction (from → to)

### Visual highlighting:

When a path is found:
1. All path nodes get the CSS class `highlighted` (2D) or gold color override (3D)
2. Edges between consecutive path nodes are highlighted in amber
3. In 3D, path edges get animated directional particles

---

## 13. Filtering & Thresholds

### Graph query filters:

| Filter | Parameter | Effect |
|--------|-----------|--------|
| Node limit | `limit` (default: 200) | Caps total `TRANSFER` relationships returned |
| Coin type | `coin_type` | Only show transfers of a specific coin (e.g. ETH) |
| Center address | `address` | Ego-centric subgraph: 1-hop neighbourhood of a wallet |

### 3D value_lossless threshold:

The Z-threshold slider filters nodes by their normalized `value_lossless`:

```javascript
if (valueLosslessThreshold > 0 && normalized < valueLosslessThreshold) {
  continue; // node excluded from 3D scene
}
```

- Slider range: 0% to 100%
- At 0%: all nodes visible
- At 50%: only top-half volume nodes visible
- At 100%: only the highest-volume node visible
- Edges to filtered-out nodes are automatically excluded

### Suspicious activity filters:

| Parameter | What it controls | Default |
|-----------|-----------------|---------|
| `type` | Detection algorithm | `circular` |
| `threshold` | Min degree for fan-out/fan-in/clusters | 5 |
| `limit` | Max results returned | 20 |
| `windowSeconds` | Time window for rapid transfers | 60s |

---

## 14. Temporal Animation

### Timestamp normalization (backend):

The graph route normalizes all edge timestamps to `[0, 1]`:

```javascript
normalizedTime = (timestamp_ms − tsMin) / (tsMax − tsMin)
```

The `parseTimestamp()` helper handles multiple formats:
- Pure numeric: auto-detects seconds vs. milliseconds (threshold: 1e12)
- ISO 8601 strings: parsed via `new Date()`

### Animation mode (frontend):

When the user enables the "Timeline" toggle:

1. All edges are sorted by `normalizedTime` (ascending).
2. A `requestAnimationFrame` loop runs over 8 seconds.
3. At time $t$ (0 → 1), only edges with `normalizedTime ≤ t` are visible.
4. The graph progressively reveals transactions in chronological order.

```javascript
const t = Math.min(1, elapsed / 8000);  // progress 0..1
const visibleLinks = sorted.filter(l => l.normalizedTime <= t);
Graph.graphData({ nodes: graphData.nodes, links: visibleLinks });
```

This reveals temporal patterns like bursts, cascading transactions, and fund flow sequences that are invisible in a static view.

---

## 15. Performance Considerations

### Backend:

- **Batch ingestion**: Transactions are inserted in batches of 1,000 to keep Neo4j heap usage manageable
- **Indexed lookups**: Unique constraints on `Wallet.address` and `Coin.name` ensure O(1) lookups; indexes on `TRANSFER.timestamp` and `TRANSFER.txid` speed up time-range and ID queries
- **Bulk risk scoring**: Single `UNWIND` query instead of per-wallet queries
- **LIMIT clauses**: All Cypher queries are capped to prevent unbounded scans

### Frontend (2D):

- **maxSimulationTime**: Cola layout capped at 500ms — prevents UI freeze on large graphs
- **Custom wheel zoom**: Delegates zoom to a configurable handler rather than Cytoscape's default

### Frontend (3D):

- **Warm-up ticks**: 100 ticks computed before first render — avoids the "exploding graph" on first frame
- **Alpha decay 0.02**: Slower cooling = smoother final layout, but the cooldown cap (200 ticks) prevents infinite animation
- **AdditiveBlending**: GPU composites glow sprites without per-pixel alpha sorting — fast even with thousands of nodes
- **SphereGeometry(nodeSize × 0.5, 16, 16)**: Low poly count per node for GPU efficiency
- **ResizeObserver**: Graph auto-resizes without re-initialization
- **Dynamic import**: `3d-force-graph` and `three` are loaded lazily (not bundled in initial SSR payload)
- **Volume threshold filtering**: Removes low-volume nodes (by log-normalized threshold) from the scene graph, reducing draw calls
- **In-memory community detection**: Louvain runs on the already-fetched subgraph (O(E × iterations)), avoiding extra Neo4j round-trips or GDS dependency
- **Log-scaled dimensions**: Compresses extreme value ranges to prevent visual domination by outlier wallets
- **Temporal animation**: Uses `requestAnimationFrame` for smooth 60fps edge reveal without blocking UI

### Data caps:

| Resource | Limit | Configurable |
|----------|-------|-------------|
| CSV upload | 50 MB | `server.js` multipart config |
| Graph nodes shown | 200 (default) | `nodeLimit` in UI |
| Shortest path depth | 10 hops | Hardcoded in Cypher |
| Cycle detection depth | 2–6 hops | Hardcoded in Cypher |
| Validation errors logged | 10 max | `parser.js` |
