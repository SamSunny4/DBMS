import { getSession } from '../neo4j/driver.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

export default async function datasetRoutes(fastify) {
  // ── List the authenticated user's datasets ─────────────────────────────────
  fastify.get('/user/datasets', { onRequest: [authMiddleware] }, async (request, reply) => {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (d:UserDataset {owner: $username})
         RETURN d ORDER BY d.created_at DESC`,
        { username: request.user.username }
      );

      const datasets = result.records.map((r) => {
        const d = r.get('d').properties;
        return {
          id: d.id,
          name: d.name,
          filename: d.filename,
          owner: d.owner,
          rowCount: toNum(d.row_count),
          createdAt: toNum(d.created_at),
        };
      });

      return { datasets };
    } finally {
      await session.close();
    }
  });

  // ── Delete a user's dataset (and all its Neo4j data) ──────────────────────
  fastify.delete('/user/datasets/:datasetId', { onRequest: [authMiddleware] }, async (request, reply) => {
    const { datasetId } = request.params;
    const username = request.user.username;

    // Reject any dataset_id that doesn't belong to the requester — the id is
    // prefixed with `user_<username>_` but we do a DB ownership check too.
    const session = getSession();
    try {
      const ownerCheck = await session.run(
        'MATCH (d:UserDataset {id: $id, owner: $username}) RETURN d',
        { id: datasetId, username }
      );
      if (ownerCheck.records.length === 0) {
        return reply.code(404).send({ error: 'Dataset not found or access denied' });
      }

      // Delete all TRANSFER relationships in this dataset
      await session.run(
        'MATCH ()-[t:TRANSFER {dataset_id: $datasetId}]->() DELETE t',
        { datasetId }
      );
      // Delete all Wallet nodes in this dataset (DETACH to handle residual rels)
      await session.run(
        'MATCH (w:Wallet {dataset_id: $datasetId}) DETACH DELETE w',
        { datasetId }
      );
      // Delete the UserDataset metadata node
      await session.run(
        'MATCH (d:UserDataset {id: $id}) DELETE d',
        { id: datasetId }
      );

      return { success: true };
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
