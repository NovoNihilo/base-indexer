import type Database from 'better-sqlite3';

export function createTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS blocks (
      number INTEGER PRIMARY KEY,
      hash TEXT NOT NULL,
      parentHash TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      gasUsed TEXT NOT NULL,
      gasLimit TEXT NOT NULL,
      baseFeePerGas TEXT,
      reorged INTEGER DEFAULT 0,
      createdAt INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS transactions (
      hash TEXT PRIMARY KEY,
      blockNumber INTEGER NOT NULL,
      fromAddr TEXT NOT NULL,
      toAddr TEXT,
      value TEXT NOT NULL,
      input TEXT NOT NULL,
      gasPrice TEXT,
      maxFeePerGas TEXT,
      maxPriorityFeePerGas TEXT,
      FOREIGN KEY (blockNumber) REFERENCES blocks(number)
    );

    CREATE TABLE IF NOT EXISTS receipts (
      txHash TEXT PRIMARY KEY,
      blockNumber INTEGER NOT NULL,
      status INTEGER,
      gasUsed TEXT NOT NULL,
      logCount INTEGER NOT NULL,
      contractAddress TEXT,
      FOREIGN KEY (txHash) REFERENCES transactions(hash)
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      txHash TEXT NOT NULL,
      blockNumber INTEGER NOT NULL,
      logIndex INTEGER NOT NULL,
      address TEXT NOT NULL,
      topic0 TEXT,
      topic1 TEXT,
      topic2 TEXT,
      topic3 TEXT,
      data TEXT,
      FOREIGN KEY (txHash) REFERENCES transactions(hash)
    );

    CREATE TABLE IF NOT EXISTS block_metrics (
      blockNumber INTEGER PRIMARY KEY,
      txCount INTEGER NOT NULL,
      logCount INTEGER NOT NULL,
      gasUsed TEXT NOT NULL,
      avgGasPerTx TEXT,
      topContracts TEXT,
      FOREIGN KEY (blockNumber) REFERENCES blocks(number)
    );

    CREATE TABLE IF NOT EXISTS event_counts (
      blockNumber INTEGER NOT NULL,
      eventType TEXT NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY (blockNumber, eventType),
      FOREIGN KEY (blockNumber) REFERENCES blocks(number)
    );

    CREATE TABLE IF NOT EXISTS checkpoint (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      lastBlock INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_logs_topic0 ON logs(topic0);
    CREATE INDEX IF NOT EXISTS idx_logs_address ON logs(address);
    CREATE INDEX IF NOT EXISTS idx_tx_block ON transactions(blockNumber);
  `);
}
