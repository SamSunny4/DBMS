/**
 * Louvain-style community detection for the wallet graph.
 *
 * This runs Client-side Louvain on an adjacency list built from the
 * already-fetched subgraph elements (nodes + edges).  It does NOT require
 * Neo4j GDS — the algorithm operates on the in-memory element arrays that
 * the `/graph` endpoint has already retrieved.
 *
 * Complexity: O(E · iterations) — fine for the ≤ 1 000-node subgraphs we serve.
 */

/**
 * Run Louvain community detection on the elements subgraph.
 *
 * @param {{ nodes: Array, edges: Array }} elements  – Cytoscape-format elements
 * @returns {Map<string, number>}  nodeId → clusterId
 */
export function detectCommunities(elements) {
  const { nodes, edges } = elements;
  if (!nodes?.length) return new Map();

  // --- Build adjacency / weight structures ---
  const nodeIds = nodes.map((n) => n.data.id);
  const idIndex = new Map(nodeIds.map((id, i) => [id, i]));
  const n = nodeIds.length;

  // Adjacency: neighbours[i] = [ { j, w }, … ]
  const neighbours = Array.from({ length: n }, () => []);
  let totalWeight = 0;

  for (const edge of edges) {
    const si = idIndex.get(edge.data.source);
    const ti = idIndex.get(edge.data.target);
    if (si === undefined || ti === undefined) continue;

    const w = parseFloat(edge.data.amount || 1) || 1;
    neighbours[si].push({ j: ti, w });
    neighbours[ti].push({ j: si, w }); // treat as undirected
    totalWeight += w;
  }

  if (totalWeight === 0) totalWeight = 1;
  const m2 = 2 * totalWeight; // 2m

  // Weighted degree for each node
  const degree = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (const { w } of neighbours[i]) s += w;
    degree[i] = s;
  }

  // --- Phase 1: local moves ---
  // Each node starts in its own community
  const community = new Int32Array(n);
  for (let i = 0; i < n; i++) community[i] = i;

  // Community total weight (sum of degrees of members)
  const commDegree = new Float64Array(n);
  for (let i = 0; i < n; i++) commDegree[i] = degree[i];

  // Community internal weight (sum of edge weights within community)
  const commInternalW = new Float64Array(n);

  const MAX_ITER = 20;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    let moved = false;

    for (let i = 0; i < n; i++) {
      const ci = community[i];
      const ki = degree[i];

      // Sum of weights from i to nodes in each neighbouring community
      const commWeights = new Map(); // commId → weight
      for (const { j, w } of neighbours[i]) {
        const cj = community[j];
        commWeights.set(cj, (commWeights.get(cj) || 0) + w);
      }

      // Remove i from its current community
      const wIC = commWeights.get(ci) || 0; // weight from i to own community
      commDegree[ci] -= ki;
      commInternalW[ci] -= wIC;

      // Find best community
      let bestComm = ci;
      let bestDQ = 0;

      for (const [cj, wIJ] of commWeights) {
        // Modularity gain of moving i into cj
        const dQ = wIJ / m2 - (commDegree[cj] * ki) / (m2 * m2) * 2;
        if (dQ > bestDQ) {
          bestDQ = dQ;
          bestComm = cj;
        }
      }

      // Also consider staying (bestDQ = 0 means staying is at least as good)
      community[i] = bestComm;
      commDegree[bestComm] += ki;
      commInternalW[bestComm] += commWeights.get(bestComm) || 0;

      if (bestComm !== ci) moved = true;
    }

    if (!moved) break;
  }

  // --- Renumber communities contiguously ---
  const renumber = new Map();
  let nextId = 0;
  const result = new Map();
  for (let i = 0; i < n; i++) {
    let c = community[i];
    if (!renumber.has(c)) renumber.set(c, nextId++);
    result.set(nodeIds[i], renumber.get(c));
  }

  return result;
}

/**
 * Generate a deterministic color for a cluster ID.
 * Uses the golden-angle hue spacing for maximal perceptual separation.
 */
export function clusterColor(clusterId, totalClusters = 12) {
  const hue = (clusterId * 137.508) % 360;
  return `hsl(${Math.round(hue)}, 70%, 55%)`;
}
