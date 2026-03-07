import { runDetection } from '../services/detection.js';

const VALID_TYPES = ['circular', 'fanout', 'fanin', 'rapid', 'cluster'];

export default async function suspiciousRoutes(fastify) {
  fastify.get('/suspicious', async (request, reply) => {
    const type = request.query.type || 'circular';
    const threshold = parseInt(request.query.threshold || '5', 10);
    const limit = parseInt(request.query.limit || '20', 10);
    const windowSeconds = parseInt(request.query.window || '60', 10);

    if (!VALID_TYPES.includes(type)) {
      return reply.code(400).send({
        error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}`,
      });
    }

    const results = await runDetection(type, { threshold, limit, windowSeconds });

    return {
      type,
      count: results.length,
      params: { threshold, limit, windowSeconds },
      suspiciousWallets: results,
    };
  });
}
