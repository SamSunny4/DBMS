import { getSession } from './driver.js';

export async function ensureSchema() {
  const session = getSession();
  try {
    // Uniqueness constraints
    await session.run(
      'CREATE CONSTRAINT wallet_address IF NOT EXISTS FOR (w:Wallet) REQUIRE w.address IS UNIQUE'
    );
    await session.run(
      'CREATE CONSTRAINT coin_name IF NOT EXISTS FOR (c:Coin) REQUIRE c.name IS UNIQUE'
    );

    // Indexes for performance
    await session.run(
      'CREATE INDEX transfer_timestamp IF NOT EXISTS FOR ()-[t:TRANSFER]-() ON (t.timestamp)'
    );
    await session.run(
      'CREATE INDEX transfer_txid IF NOT EXISTS FOR ()-[t:TRANSFER]-() ON (t.txid)'
    );
  } finally {
    await session.close();
  }
}
