import { getSession } from '../neo4j/driver.js';

// --- Circular Transfers ---
export async function detectCircularTransfers(limit = 20, datasetId = 'shared') {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH path = (w:Wallet {dataset_id: $datasetId})-[:TRANSFER*2..6]->(w)
       WITH w, path, length(path) AS depth
       ORDER BY depth ASC
       LIMIT toInteger($limit)
       RETURN w.address AS address,
              depth,
              [n IN nodes(path) | n.address] AS cycle,
              [r IN relationships(path) | {amount: r.amount, coin: r.coin_type, txid: r.txid}] AS transfers`,
      { limit: parseInt(limit), datasetId }
    );

    return result.records.map((r) => ({
      address: r.get('address'),
      riskType: 'circular',
      depth: typeof r.get('depth') === 'object' ? r.get('depth').toNumber() : r.get('depth'),
      cycle: r.get('cycle'),
      transfers: r.get('transfers'),
    }));
  } finally {
    await session.close();
  }
}

// --- High Fan-Out ---
export async function detectHighFanOut(threshold = 5, limit = 20, datasetId = 'shared') {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (w:Wallet {dataset_id: $datasetId})-[t:TRANSFER]->()
       WITH w, count(t) AS outDegree, sum(t.amount) AS totalSent
       WHERE outDegree >= toInteger($threshold)
       RETURN w.address AS address, outDegree, totalSent
       ORDER BY outDegree DESC
       LIMIT toInteger($limit)`,
      { threshold: parseInt(threshold), limit: parseInt(limit), datasetId }
    );

    return result.records.map((r) => ({
      address: r.get('address'),
      riskType: 'fanout',
      outDegree: toNum(r.get('outDegree')),
      totalSent: toNum(r.get('totalSent')),
    }));
  } finally {
    await session.close();
  }
}

// --- High Fan-In ---
export async function detectHighFanIn(threshold = 5, limit = 20, datasetId = 'shared') {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH ()-[t:TRANSFER]->(w:Wallet {dataset_id: $datasetId})
       WITH w, count(t) AS inDegree, sum(t.amount) AS totalReceived
       WHERE inDegree >= toInteger($threshold)
       RETURN w.address AS address, inDegree, totalReceived
       ORDER BY inDegree DESC
       LIMIT toInteger($limit)`,
      { threshold: parseInt(threshold), limit: parseInt(limit), datasetId }
    );

    return result.records.map((r) => ({
      address: r.get('address'),
      riskType: 'fanin',
      inDegree: toNum(r.get('inDegree')),
      totalReceived: toNum(r.get('totalReceived')),
    }));
  } finally {
    await session.close();
  }
}

// --- Rapid Transfers ---
export async function detectRapidTransfers(windowSeconds = 60, limit = 20, datasetId = 'shared') {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (a:Wallet {dataset_id: $datasetId})-[t1:TRANSFER]->(b:Wallet {dataset_id: $datasetId})-[t2:TRANSFER]->(c:Wallet {dataset_id: $datasetId})
       WHERE a <> c
         AND toInteger(t2.timestamp) - toInteger(t1.timestamp) >= 0
         AND toInteger(t2.timestamp) - toInteger(t1.timestamp) <= toInteger($windowSeconds)
       RETURN a.address AS from, b.address AS via, c.address AS to,
              t1.amount AS amount1, t2.amount AS amount2,
              t1.timestamp AS ts1, t2.timestamp AS ts2,
              t1.txid AS txid1, t2.txid AS txid2
       LIMIT toInteger($limit)`,
      { windowSeconds: parseInt(windowSeconds), limit: parseInt(limit), datasetId }
    );

    return result.records.map((r) => ({
      riskType: 'rapid',
      from: r.get('from'),
      via: r.get('via'),
      to: r.get('to'),
      amount1: toNum(r.get('amount1')),
      amount2: toNum(r.get('amount2')),
      ts1: r.get('ts1'),
      ts2: r.get('ts2'),
    }));
  } finally {
    await session.close();
  }
}

// --- Dense Clusters ---
export async function detectDenseClusters(threshold = 3, limit = 20, datasetId = 'shared') {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (w:Wallet {dataset_id: $datasetId})
       OPTIONAL MATCH (w)-[out:TRANSFER]->()
       WITH w, count(out) AS outDeg
       OPTIONAL MATCH ()-[inr:TRANSFER]->(w)
       WITH w, outDeg, count(inr) AS inDeg
       WHERE outDeg >= toInteger($threshold) AND inDeg >= toInteger($threshold)
       RETURN w.address AS address, outDeg, inDeg, (outDeg + inDeg) AS totalDeg
       ORDER BY totalDeg DESC
       LIMIT toInteger($limit)`,
      { threshold: parseInt(threshold), limit: parseInt(limit), datasetId }
    );

    return result.records.map((r) => ({
      address: r.get('address'),
      riskType: 'cluster',
      outDegree: toNum(r.get('outDeg')),
      inDegree: toNum(r.get('inDeg')),
      totalDegree: toNum(r.get('totalDeg')),
    }));
  } finally {
    await session.close();
  }
}

// --- Risk Score ---
export async function calculateRiskScore(address) {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (w:Wallet {address: $address})
       OPTIONAL MATCH (w)-[out:TRANSFER]->()
       WITH w, count(out) AS outDeg
       OPTIONAL MATCH ()-[inr:TRANSFER]->(w)
       WITH w, outDeg, count(inr) AS inDeg
       OPTIONAL MATCH path = (w)-[:TRANSFER*2..4]->(w)
       WITH w, outDeg, inDeg, count(path) AS cycles
       RETURN outDeg, inDeg, cycles`,
      { address }
    );

    if (result.records.length === 0) return 0;

    const r = result.records[0];
    const outDeg = toNum(r.get('outDeg'));
    const inDeg = toNum(r.get('inDeg'));
    const cycles = toNum(r.get('cycles'));

    // Scoring: each factor contributes to a 0-100 score
    let score = 0;
    // Fan-out score (max 25)
    score += Math.min(25, outDeg * 5);
    // Fan-in score (max 25)
    score += Math.min(25, inDeg * 5);
    // Cycle involvement (max 30)
    score += Math.min(30, cycles * 15);
    // High total degree (max 20)
    const totalDeg = outDeg + inDeg;
    score += Math.min(20, totalDeg * 2);

    return Math.min(100, score);
  } finally {
    await session.close();
  }
}

// --- Run all detectors ---
export async function runDetection(type, options = {}) {
  const { threshold, limit, windowSeconds, datasetId = 'shared' } = options;

  switch (type) {
    case 'circular':
      return detectCircularTransfers(limit, datasetId);
    case 'fanout':
      return detectHighFanOut(threshold, limit, datasetId);
    case 'fanin':
      return detectHighFanIn(threshold, limit, datasetId);
    case 'rapid':
      return detectRapidTransfers(windowSeconds, limit, datasetId);
    case 'cluster':
      return detectDenseClusters(threshold, limit, datasetId);
    default:
      throw new Error(`Unknown detection type: ${type}`);
  }
}

function toNum(val) {
  if (val == null) return 0;
  if (typeof val === 'object' && typeof val.toNumber === 'function') return val.toNumber();
  return Number(val) || 0;
}

// Compute risk scores for multiple addresses in a single Cypher UNWIND query.
// Accepts an optional already-open session so the caller controls its lifecycle.
export async function bulkRiskScores(addresses, existingSession, datasetId = 'shared') {
  const session = existingSession || getSession();
  const owned = !existingSession;
  try {
    const result = await session.run(
      `UNWIND $addresses AS addr
       MATCH (w:Wallet {address: addr, dataset_id: $datasetId})
       OPTIONAL MATCH (w)-[out:TRANSFER]->()
       WITH w, addr, count(out) AS outDeg
       OPTIONAL MATCH ()-[inr:TRANSFER]->(w)
       WITH w, addr, outDeg, count(inr) AS inDeg
       OPTIONAL MATCH p = (w)-[:TRANSFER*2..4]->(w)
       WITH addr, outDeg, inDeg, count(p) AS cycles
       WITH addr, outDeg, inDeg, cycles,
            CASE WHEN outDeg * 5 < 25 THEN outDeg * 5 ELSE 25 END AS foScore,
            CASE WHEN inDeg * 5 < 25 THEN inDeg * 5 ELSE 25 END AS fiScore,
            CASE WHEN cycles * 15 < 30 THEN cycles * 15 ELSE 30 END AS cycleScore,
            CASE WHEN (outDeg + inDeg) * 2 < 20 THEN (outDeg + inDeg) * 2 ELSE 20 END AS degScore
       WITH addr, foScore + fiScore + cycleScore + degScore AS rawScore
       RETURN addr,
              CASE WHEN rawScore < 100 THEN rawScore ELSE 100 END AS score`,
      { addresses, datasetId }
    );

    const map = {};
    for (const rec of result.records) {
      map[rec.get('addr')] = toNum(rec.get('score'));
    }
    for (const addr of addresses) {
      if (!(addr in map)) map[addr] = 0;
    }
    return map;
  } finally {
    if (owned) await session.close();
  }
}
