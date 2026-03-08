import { getSession } from '../neo4j/driver.js';
import { neo4jToCytoscape } from '../services/graph-transform.js';
import { bulkRiskScores } from '../services/detection.js';
import { detectCommunities } from '../services/community.js';

// ── Fraud pattern classification (runs on already-fetched subgraph) ──
function classifyFraudPatterns(elements) {
  const nodeMap = new Map(); // id → { outDeg, inDeg, outTargets, inSources, totalVol }
  for (const n of elements.nodes) {
    nodeMap.set(n.data.id, { outDeg: 0, inDeg: 0, outTargets: new Set(), inSources: new Set(), totalVol: 0 });
  }

  // Adjacency for cycle detection (directed)
  const adj = new Map(); // id → [target_id, …]

  for (const e of elements.edges) {
    const s = e.data.source;
    const t = e.data.target;
    const amt = parseFloat(e.data.amount || 0);
    if (nodeMap.has(s)) {
      const ns = nodeMap.get(s);
      ns.outDeg++;
      ns.outTargets.add(t);
      ns.totalVol += amt;
    }
    if (nodeMap.has(t)) {
      const nt = nodeMap.get(t);
      nt.inDeg++;
      nt.inSources.add(s);
      nt.totalVol += amt;
    }
    if (!adj.has(s)) adj.set(s, []);
    adj.get(s).push(t);
  }

  // Simple cycle check (DFS up to depth 6 from each node)
  const inCycle = new Set();
  for (const startId of nodeMap.keys()) {
    const visited = new Set();
    const stack = [[startId, 0]];
    while (stack.length > 0) {
      const [cur, depth] = stack.pop();
      if (depth > 0 && cur === startId) { inCycle.add(startId); break; }
      if (depth >= 6 || visited.has(cur)) continue;
      visited.add(cur);
      for (const nb of adj.get(cur) || []) {
        stack.push([nb, depth + 1]);
      }
    }
  }

  // Classify each node
  const patterns = {};  // id → pattern type string
  for (const [id, info] of nodeMap) {
    const { outDeg, inDeg, outTargets, inSources } = info;
    const totalDeg = outDeg + inDeg;
    const hasCycle = inCycle.has(id);

    if (hasCycle && outDeg >= 2 && inDeg >= 2) {
      patterns[id] = 'circular';       // circular laundering
    } else if (outDeg >= 5 && inDeg <= 1) {
      patterns[id] = 'fanout';          // fan-out / distribution scam
    } else if (inDeg >= 5 && outDeg <= 1) {
      patterns[id] = 'fanin';           // collection point
    } else if (totalDeg >= 8) {
      patterns[id] = 'hub';             // exchange hub
    } else if (outDeg >= 3 && inDeg >= 3) {
      patterns[id] = 'mixer';           // mixing service
    } else {
      patterns[id] = 'normal';
    }
  }

  return patterns;
}

export default async function graphRoutes(fastify) {
  fastify.get('/graph', async (request, reply) => {
    const limit = parseInt(request.query.limit || '200', 10);
    const coinType = request.query.coin_type || null;
    const address = request.query.address || null;

    const session = getSession();
    try {
      let cypher;
      const params = { limit };

      if (address) {
        // Ego-centered subgraph (1-hop neighborhood)
        cypher = `
          MATCH (center:Wallet {address: $address})-[t:TRANSFER]-(neighbor:Wallet)
          ${coinType ? 'WHERE t.coin_type = $coinType' : ''}
          RETURN center, t, neighbor
          LIMIT toInteger($limit)
        `;
        if (coinType) params.coinType = coinType;
        params.address = address;
      } else if (coinType) {
        // Filter by coin type
        cypher = `
          MATCH (a:Wallet)-[t:TRANSFER]->(b:Wallet)
          WHERE t.coin_type = $coinType
          RETURN a, t, b
          LIMIT toInteger($limit)
        `;
        params.coinType = coinType;
      } else {
        // General subgraph
        cypher = `
          MATCH (a:Wallet)-[t:TRANSFER]->(b:Wallet)
          RETURN a, t, b
          LIMIT toInteger($limit)
        `;
      }

      const result = await session.run(cypher, params);
      const elements = neo4jToCytoscape(result.records);

      // ── Risk scores ─────────────────────────────────────────────────
      const walletAddresses = elements.nodes
        .filter((n) => n.data.nodeType === 'Wallet')
        .map((n) => n.data.label);

      if (walletAddresses.length > 0) {
        const scores = await bulkRiskScores(walletAddresses, session);
        for (const node of elements.nodes) {
          if (node.data.nodeType === 'Wallet') {
            node.data.riskScore = scores[node.data.label] ?? 0;
          }
        }
      }

      // ── Per-node total volume (sum of value_lossless on all edges) ──
      const nodeVolume = new Map();
      for (const edge of elements.edges) {
        const val = parseFloat(edge.data.value_lossless || edge.data.amount || 0);
        if (!isNaN(val)) {
          nodeVolume.set(edge.data.source, (nodeVolume.get(edge.data.source) || 0) + val);
          nodeVolume.set(edge.data.target, (nodeVolume.get(edge.data.target) || 0) + val);
        }
      }

      // ── Log-scaled volume & normalization ───────────────────────────
      // log_volume = log10(total_volume + 1)
      // normalized = (log_volume - min) / (max - min)
      const logVolumes = new Map();
      let logMin = Infinity;
      let logMax = -Infinity;

      for (const node of elements.nodes) {
        const totalVol = nodeVolume.get(node.data.id) || 0;
        const logVol = Math.log10(totalVol + 1);
        logVolumes.set(node.data.id, logVol);
        if (logVol < logMin) logMin = logVol;
        if (logVol > logMax) logMax = logVol;
      }

      const logRange = logMax - logMin || 1; // avoid div-by-zero

      for (const node of elements.nodes) {
        const totalVol = nodeVolume.get(node.data.id) || 0;
        const logVol = logVolumes.get(node.data.id);
        const normalized = (logVol - logMin) / logRange; // 0..1

        node.data.totalVolume = totalVol;
        node.data.logVolume = logVol;
        node.data.normalizedVolume = normalized;
        // Keep value_lossless for backward compat / tooltip display
        node.data.value_lossless = totalVol;
      }

      // ── Edge log-width ──────────────────────────────────────────────
      // width = log10(amount + 1) → then frontend scales to visual range
      for (const edge of elements.edges) {
        const amt = parseFloat(edge.data.amount || 0);
        edge.data.logAmount = Math.log10(amt + 1);
      }

      // ── Community detection (Louvain on subgraph) ───────────────────
      const communities = detectCommunities(elements);
      const clusterSizes = new Map();
      for (const [, cid] of communities) {
        clusterSizes.set(cid, (clusterSizes.get(cid) || 0) + 1);
      }
      for (const node of elements.nodes) {
        node.data.clusterId = communities.get(node.data.id) ?? -1;
      }

      // ── Fraud pattern classification ────────────────────────────────
      const fraudPatterns = classifyFraudPatterns(elements);
      for (const node of elements.nodes) {
        node.data.fraudPattern = fraudPatterns[node.data.id] || 'normal';
      }

      // ── Temporal normalization ──────────────────────────────────────
      // Normalize edge timestamps to [0, 1] for optional animation
      let tsMin = Infinity;
      let tsMax = -Infinity;
      for (const edge of elements.edges) {
        const ts = parseTimestamp(edge.data.timestamp);
        if (ts !== null) {
          if (ts < tsMin) tsMin = ts;
          if (ts > tsMax) tsMax = ts;
        }
      }
      const tsRange = tsMax - tsMin || 1;
      for (const edge of elements.edges) {
        const ts = parseTimestamp(edge.data.timestamp);
        edge.data.normalizedTime = ts !== null ? (ts - tsMin) / tsRange : 0;
      }

      // ── Total counts ───────────────────────────────────────────────
      const countResult = await session.run(
        `MATCH (w:Wallet) WITH count(w) AS wc
         MATCH ()-[t:TRANSFER]->() RETURN wc, count(t) AS tc`
      );

      const totalWallets = countResult.records[0]?.get('wc');
      const totalTransfers = countResult.records[0]?.get('tc');

      return {
        elements,
        nodeCount: elements.nodes.length,
        edgeCount: elements.edges.length,
        totalWallets: toNum(totalWallets),
        totalTransfers: toNum(totalTransfers),
        clusterCount: clusterSizes.size,
        truncated: elements.edges.length >= limit,
        filters: { limit, coinType, address },
      };
    } finally {
      await session.close();
    }
  });
}

/** Convert timestamp string to epoch ms. Returns null on failure. */
function parseTimestamp(ts) {
  if (ts == null) return null;
  const s = String(ts).trim();
  // Pure numeric → epoch seconds or ms
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    return n > 1e12 ? n : n * 1000; // ms vs s heuristic
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.getTime();
}

function toNum(val) {
  if (val == null) return 0;
  if (typeof val === 'object' && typeof val.toNumber === 'function') return val.toNumber();
  return Number(val) || 0;
}
