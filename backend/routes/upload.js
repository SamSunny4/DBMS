import { parseCSV, parseJSON, detectFormat } from '../ingestion/parser.js';
import { ingestTransactions } from '../services/ingestion.js';
import { adminMiddleware, authMiddleware } from '../middleware/authMiddleware.js';
import { getSession } from '../neo4j/driver.js';

export default async function uploadRoutes(fastify) {
  // ── Admin: upload to shared (main) dataset ─────────────────────────────────
  fastify.post('/upload-transactions', { onRequest: [adminMiddleware] }, async (request, reply) => {
    const data = await request.file();

    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    const filename = data.filename;
    const format = detectFormat(filename);

    if (!format) {
      return reply.code(400).send({
        error: 'Unsupported file format. Please upload a .csv or .json file.',
      });
    }

    const chunks = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const text = Buffer.concat(chunks).toString('utf-8');

    if (!text.trim()) {
      return reply.code(400).send({ error: 'Uploaded file is empty' });
    }

    let parseResult;
    try {
      parseResult = format === 'csv' ? parseCSV(text) : parseJSON(text);
    } catch (err) {
      return reply.code(400).send({ error: err.message });
    }

    const ingestionResult = await ingestTransactions(parseResult.transactions, 'shared');

    return {
      success: true,
      filename,
      format,
      totalRows: parseResult.totalRows,
      validTransactions: parseResult.transactions.length,
      parseErrors: parseResult.errors,
      ...ingestionResult,
    };
  });

  // ── User: upload to own private dataset ────────────────────────────────────
  fastify.post('/user/upload', { onRequest: [authMiddleware] }, async (request, reply) => {
    const data = await request.file();

    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    const filename = data.filename;
    const format = detectFormat(filename);

    if (!format) {
      return reply.code(400).send({
        error: 'Unsupported file format. Please upload a .csv or .json file.',
      });
    }

    const chunks = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const text = Buffer.concat(chunks).toString('utf-8');

    if (!text.trim()) {
      return reply.code(400).send({ error: 'Uploaded file is empty' });
    }

    let parseResult;
    try {
      parseResult = format === 'csv' ? parseCSV(text) : parseJSON(text);
    } catch (err) {
      return reply.code(400).send({ error: err.message });
    }

    const username = request.user.username;
    const datasetId = `user_${username}_${Date.now()}`;
    const datasetName = request.query.name
      ? decodeURIComponent(request.query.name).slice(0, 100)
      : filename.replace(/\.[^.]+$/, '').slice(0, 100);

    // Record the dataset metadata
    const session = getSession();
    try {
      await session.run(
        `CREATE (d:UserDataset {
          id: $id,
          owner: $username,
          name: $name,
          filename: $filename,
          created_at: timestamp(),
          row_count: $rowCount
        })`,
        { id: datasetId, username, name: datasetName, filename, rowCount: parseResult.transactions.length }
      );
    } finally {
      await session.close();
    }

    const ingestionResult = await ingestTransactions(parseResult.transactions, datasetId);

    return {
      success: true,
      dataset: { id: datasetId, name: datasetName, filename },
      totalRows: parseResult.totalRows,
      validTransactions: parseResult.transactions.length,
      parseErrors: parseResult.errors,
      ...ingestionResult,
    };
  });
}
