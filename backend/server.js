import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { getDriver, closeDriver } from './neo4j/driver.js';
import { ensureSchema } from './neo4j/schema.js';
import uploadRoutes from './routes/upload.js';
import walletRoutes from './routes/wallet.js';
import transactionRoutes from './routes/transactions.js';
import graphRoutes from './routes/graph.js';
import statsRoutes from './routes/stats.js';
import suspiciousRoutes from './routes/suspicious.js';

const fastify = Fastify({ logger: true });

await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
});

await fastify.register(multipart, {
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
  },
});

// Register routes
await fastify.register(uploadRoutes);
await fastify.register(walletRoutes);
await fastify.register(transactionRoutes);
await fastify.register(graphRoutes);
await fastify.register(statsRoutes);
await fastify.register(suspiciousRoutes);

// Graceful shutdown
fastify.addHook('onClose', async () => {
  await closeDriver();
});

// Health check
fastify.get('/health', async () => ({ status: 'ok' }));

const start = async () => {
  try {
    // Initialize Neo4j driver and schema
    getDriver();
    await ensureSchema();
    fastify.log.info('Neo4j schema initialized');

    const port = parseInt(process.env.PORT || '4000', 10);
    await fastify.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
