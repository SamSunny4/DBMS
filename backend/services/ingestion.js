import { getSession } from '../neo4j/driver.js';

const BATCH_SIZE = 1000;

const INGEST_CYPHER = `
  UNWIND $transactions AS tx
  MERGE (from:Wallet {address: tx.wallet_from})
  MERGE (to:Wallet {address: tx.wallet_to})
  MERGE (c:Coin {name: tx.coin_type})
  MERGE (from)-[:USES]->(c)
  MERGE (to)-[:USES]->(c)
  CREATE (from)-[:TRANSFER {
    amount: toFloat(tx.amount),
    timestamp: tx.timestamp,
    coin_type: tx.coin_type,
    txid: tx.transaction_id
  }]->(to)
  RETURN count(*) AS created
`;

export async function ingestTransactions(transactions) {
  const session = getSession();
  let totalCreated = 0;

  try {
    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const batch = transactions.slice(i, i + BATCH_SIZE);
      const result = await session.run(INGEST_CYPHER, { transactions: batch });
      const created = result.records[0]?.get('created')?.toNumber?.() ?? 0;
      totalCreated += created;
    }
  } finally {
    await session.close();
  }

  return {
    transactionsProcessed: transactions.length,
    relationshipsCreated: totalCreated,
    batches: Math.ceil(transactions.length / BATCH_SIZE),
  };
}
