import { getSession } from '../neo4j/driver.js';

export default async function adminRoutes(fastify) {
  fastify.delete('/clear-database', async (request, reply) => {
    const session = getSession();
    try {
      // Delete all relationships first, then all nodes
      await session.run('MATCH ()-[r]->() DELETE r');
      const nodeResult = await session.run('MATCH (n) DELETE n RETURN count(n) AS deleted');
      const deleted = nodeResult.records[0]?.get('deleted');
      const count = (deleted && typeof deleted.toNumber === 'function')
        ? deleted.toNumber()
        : Number(deleted) || 0;

      return { success: true, nodesDeleted: count };
    } finally {
      await session.close();
    }
  });
}
