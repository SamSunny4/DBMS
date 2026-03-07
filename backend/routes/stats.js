import { getSession } from '../neo4j/driver.js';

export default async function statsRoutes(fastify) {
  fastify.get('/stats', async (request, reply) => {
    const session = getSession();
    try {
      const result = await session.run(`
        OPTIONAL MATCH (w:Wallet)
        WITH count(w) AS walletCount
        OPTIONAL MATCH ()-[t:TRANSFER]->()
        WITH walletCount, count(t) AS transactionCount
        OPTIONAL MATCH (c:Coin)
        WITH walletCount, transactionCount, count(c) AS coinCount
        OPTIONAL MATCH (sw:Wallet)-[:TRANSFER*2..4]->(sw)
        WITH walletCount, transactionCount, coinCount, count(DISTINCT sw) AS suspiciousCount
        RETURN walletCount, transactionCount, coinCount, suspiciousCount
      `);

      const r = result.records[0];

      return {
        wallets: toNum(r.get('walletCount')),
        transactions: toNum(r.get('transactionCount')),
        coins: toNum(r.get('coinCount')),
        suspiciousWallets: toNum(r.get('suspiciousCount')),
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
