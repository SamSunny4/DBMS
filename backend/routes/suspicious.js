import { runDetection } from '../services/detection.js';
import { getSession } from '../neo4j/driver.js';

const VALID_TYPES = ['circular', 'fanout', 'fanin', 'rapid', 'cluster'];

function toNum(val) {
  if (val == null) return 0;
  if (typeof val === 'object' && typeof val.toNumber === 'function') return val.toNumber();
  return Number(val) || 0;
}

export default async function suspiciousRoutes(fastify) {
  // Risk ranking: all wallets sorted by computed risk score
  fastify.get('/suspicious/risk-ranking', async (request, reply) => {
    const limit = parseInt(request.query.limit || '50', 10);
    const datasetId = request.query.dataset_id || 'shared';
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (w:Wallet {dataset_id: $datasetId})
         OPTIONAL MATCH (w)-[out:TRANSFER]->()
         WITH w, count(out) AS outDeg
         OPTIONAL MATCH ()-[inr:TRANSFER]->(w)
         WITH w, outDeg, count(inr) AS inDeg
         OPTIONAL MATCH cyc = (w)-[:TRANSFER*2..4]->(w)
         WITH w, outDeg, inDeg, count(cyc) AS cycles
         WITH w, outDeg, inDeg, cycles,
              (CASE WHEN outDeg * 5 < 25 THEN outDeg * 5 ELSE 25 END +
               CASE WHEN inDeg * 5 < 25 THEN inDeg * 5 ELSE 25 END +
               CASE WHEN cycles * 15 < 30 THEN cycles * 15 ELSE 30 END +
               CASE WHEN (outDeg + inDeg) * 2 < 20 THEN (outDeg + inDeg) * 2 ELSE 20 END) AS riskScore
         WHERE riskScore > 0
         RETURN w.address AS address, outDeg, inDeg, cycles, riskScore
         ORDER BY riskScore DESC
         LIMIT toInteger($limit)`,
        { limit, datasetId }
      );
      const wallets = result.records.map((r) => ({
        address: r.get('address'),
        outDegree: toNum(r.get('outDeg')),
        inDegree: toNum(r.get('inDeg')),
        cycles: toNum(r.get('cycles')),
        riskScore: toNum(r.get('riskScore')),
      }));
      return { count: wallets.length, wallets };
    } finally {
      await session.close();
    }
  });

  fastify.get('/suspicious', async (request, reply) => {
    const type = request.query.type || 'circular';
    const threshold = parseInt(request.query.threshold || '5', 10);
    const limit = parseInt(request.query.limit || '20', 10);
    const windowSeconds = parseInt(request.query.window || '60', 10);
    const datasetId = request.query.dataset_id || 'shared';

    if (!VALID_TYPES.includes(type)) {
      return reply.code(400).send({
        error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}`,
      });
    }

    const results = await runDetection(type, { threshold, limit, windowSeconds, datasetId });

    return {
      type,
      count: results.length,
      params: { threshold, limit, windowSeconds },
      suspiciousWallets: results,
    };
  });
}
