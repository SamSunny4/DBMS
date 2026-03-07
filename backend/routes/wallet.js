import { getSession } from '../neo4j/driver.js';
import { calculateRiskScore } from '../services/detection.js';

export default async function walletRoutes(fastify) {
  fastify.get('/wallet/:address', async (request, reply) => {
    const { address } = request.params;
    const skip = parseInt(request.query.skip || '0', 10);
    const limit = parseInt(request.query.limit || '50', 10);

    const session = getSession();
    try {
      // Get wallet summary
      const summaryResult = await session.run(
        `MATCH (w:Wallet {address: $address})
         OPTIONAL MATCH (w)-[out:TRANSFER]->()
         WITH w, count(out) AS outCount, COALESCE(sum(out.amount), 0) AS totalSent
         OPTIONAL MATCH ()-[inr:TRANSFER]->(w)
         WITH w, outCount, totalSent, count(inr) AS inCount, COALESCE(sum(inr.amount), 0) AS totalReceived
         OPTIONAL MATCH (w)-[:USES]->(c:Coin)
         RETURN w.address AS address,
                outCount, totalSent,
                inCount, totalReceived,
                collect(c.name) AS coins`,
        { address }
      );

      if (summaryResult.records.length === 0) {
        return reply.code(404).send({ error: 'Wallet not found' });
      }

      const s = summaryResult.records[0];

      // Get paginated transactions
      const txResult = await session.run(
        `MATCH (w:Wallet {address: $address})-[t:TRANSFER]-(other:Wallet)
         RETURN
           CASE WHEN startNode(t) = w THEN 'sent' ELSE 'received' END AS direction,
           other.address AS counterparty,
           t.amount AS amount,
           t.coin_type AS coin_type,
           t.timestamp AS timestamp,
           t.txid AS txid
         ORDER BY t.timestamp DESC
         SKIP toInteger($skip)
         LIMIT toInteger($limit)`,
        { address, skip, limit }
      );

      const transactions = txResult.records.map((r) => ({
        direction: r.get('direction'),
        counterparty: r.get('counterparty'),
        amount: toNum(r.get('amount')),
        coin_type: r.get('coin_type'),
        timestamp: r.get('timestamp'),
        txid: r.get('txid'),
      }));

      const riskScore = await calculateRiskScore(address);

      return {
        address: s.get('address'),
        totalSent: toNum(s.get('totalSent')),
        totalReceived: toNum(s.get('totalReceived')),
        outgoingCount: toNum(s.get('outCount')),
        incomingCount: toNum(s.get('inCount')),
        coins: s.get('coins'),
        riskScore,
        transactions,
        pagination: { skip, limit },
      };
    } finally {
      await session.close();
    }
  });
}

function toNum(val) {
  if (val == null) return 0;
  if (typeof val === 'object' && typeof val.toNumber === 'function') return val.toNumber();
  return Number(val) || 0;
}
