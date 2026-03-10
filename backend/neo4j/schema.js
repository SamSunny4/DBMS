import { getSession } from './driver.js';

export async function ensureSchema() {
  const session = getSession();
  try {
    // Drop the old single-address unique constraint — addresses are no longer globally
    // unique now that each dataset stores its own copy of wallet nodes.
    await session.run('DROP CONSTRAINT wallet_address IF EXISTS').catch(() => {});

    // wallet_key = address + '__' + dataset_id  (unique per dataset-address pair)
    await session.run(
      'CREATE CONSTRAINT wallet_key IF NOT EXISTS FOR (w:Wallet) REQUIRE w.wallet_key IS UNIQUE'
    );
    await session.run(
      'CREATE CONSTRAINT coin_name IF NOT EXISTS FOR (c:Coin) REQUIRE c.name IS UNIQUE'
    );

    // User constraints
    await session.run(
      'CREATE CONSTRAINT user_username IF NOT EXISTS FOR (u:User) REQUIRE u.username IS UNIQUE'
    );
    await session.run(
      'CREATE CONSTRAINT user_email IF NOT EXISTS FOR (u:User) REQUIRE u.email IS UNIQUE'
    );

    // UserDataset node constraint
    await session.run(
      'CREATE CONSTRAINT user_dataset_id IF NOT EXISTS FOR (d:UserDataset) REQUIRE d.id IS UNIQUE'
    );

    // Indexes for performance
    await session.run(
      'CREATE INDEX transfer_timestamp IF NOT EXISTS FOR ()-[t:TRANSFER]-() ON (t.timestamp)'
    );
    await session.run(
      'CREATE INDEX transfer_txid IF NOT EXISTS FOR ()-[t:TRANSFER]-() ON (t.txid)'
    );
    await session.run(
      'CREATE INDEX wallet_dataset_id IF NOT EXISTS FOR (w:Wallet) ON (w.dataset_id)'
    );
    await session.run(
      'CREATE INDEX transfer_dataset_id IF NOT EXISTS FOR ()-[t:TRANSFER]-() ON (t.dataset_id)'
    );
    await session.run(
      'CREATE INDEX user_created_at IF NOT EXISTS FOR (u:User) ON (u.created_at)'
    );

    // ── Migrate existing data to shared dataset ────────────────────────────
    // Tag all Wallet nodes that pre-date the multi-dataset schema
    await session.run(`
      MATCH (w:Wallet) WHERE w.dataset_id IS NULL
      SET w.dataset_id = 'shared', w.wallet_key = w.address + '__shared'
    `);
    // Tag all TRANSFER rels that pre-date the multi-dataset schema
    await session.run(`
      MATCH ()-[t:TRANSFER]->() WHERE t.dataset_id IS NULL
      SET t.dataset_id = 'shared'
    `);
  } finally {
    await session.close();
  }
}
