import { getSession } from '../neo4j/driver.js';
import { neo4jToCytoscape } from '../services/graph-transform.js';

export default async function transactionRoutes(fastify) {
  fastify.get('/transactions/path', async (request, reply) => {
    const { from, to } = request.query;

    if (!from || !to) {
      return reply.code(400).send({
        error: 'Both "from" and "to" query parameters are required',
      });
    }

    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (a:Wallet {address: $from}), (b:Wallet {address: $to})
         MATCH path = shortestPath((a)-[:TRANSFER*..10]->(b))
         RETURN path`,
        { from, to }
      );

      if (result.records.length === 0) {
        return {
          found: false,
          message: `No path found between ${from} and ${to}`,
          elements: { nodes: [], edges: [] },
        };
      }

      const elements = neo4jToCytoscape(result.records);

      // Extract path node IDs in order
      const path = result.records[0].get('path');
      const pathNodeIds = path.segments
        ? [
            path.start.identity.toString(),
            ...path.segments.map((s) => s.end.identity.toString()),
          ]
        : [];

      return {
        found: true,
        pathLength: path.segments?.length || 0,
        pathNodeIds,
        elements,
      };
    } finally {
      await session.close();
    }
  });
}
