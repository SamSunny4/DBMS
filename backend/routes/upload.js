import { parseCSV, parseJSON, detectFormat } from '../ingestion/parser.js';
import { ingestTransactions } from '../services/ingestion.js';

export default async function uploadRoutes(fastify) {
  fastify.post('/upload-transactions', async (request, reply) => {
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

    // Read the file buffer
    const chunks = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const text = Buffer.concat(chunks).toString('utf-8');

    if (!text.trim()) {
      return reply.code(400).send({ error: 'Uploaded file is empty' });
    }

    // Parse the file
    let parseResult;
    try {
      parseResult = format === 'csv' ? parseCSV(text) : parseJSON(text);
    } catch (err) {
      return reply.code(400).send({ error: err.message });
    }

    // Ingest into Neo4j
    const ingestionResult = await ingestTransactions(parseResult.transactions);

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
}
