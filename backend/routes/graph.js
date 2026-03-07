import { getSession } from '../neo4j/driver.js';
import { neo4jToCytoscape } from '../services/graph-transform.js';

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

      // Get total counts for context
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
        truncated: elements.edges.length >= limit,
        filters: { limit, coinType, address },
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
