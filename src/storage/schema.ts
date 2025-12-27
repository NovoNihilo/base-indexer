import type Database from 'better-sqlite3';

export function createTables(db: Database.Database) {
  db.exec(`
    -- Core tables
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
      gasUsed TEXT,
      effectiveGasPrice TEXT,
      txType TEXT,
      FOREIGN KEY (blockNumber) REFERENCES blocks(number)
    );

    CREATE TABLE IF NOT EXISTS receipts (
      txHash TEXT PRIMARY KEY,
      blockNumber INTEGER NOT NULL,
      status INTEGER,
      gasUsed TEXT NOT NULL,
      logCount INTEGER NOT NULL,
      contractAddress TEXT,
      effectiveGasPrice TEXT,
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

    -- Metrics tables
    CREATE TABLE IF NOT EXISTS block_metrics (
      blockNumber INTEGER PRIMARY KEY,
      txCount INTEGER NOT NULL,
      logCount INTEGER NOT NULL,
      gasUsed TEXT NOT NULL,
      avgGasPerTx TEXT,
      topContracts TEXT,
      uniqueFromAddresses INTEGER,
      uniqueToAddresses INTEGER,
      avgGasPrice TEXT,
      avgPriorityFee TEXT,
      FOREIGN KEY (blockNumber) REFERENCES blocks(number)
    );

    CREATE TABLE IF NOT EXISTS event_counts (
      blockNumber INTEGER NOT NULL,
      eventType TEXT NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY (blockNumber, eventType),
      FOREIGN KEY (blockNumber) REFERENCES blocks(number)
    );

    -- Token transfers (ERC-20)
    CREATE TABLE IF NOT EXISTS token_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      txHash TEXT NOT NULL,
      blockNumber INTEGER NOT NULL,
      logIndex INTEGER NOT NULL,
      tokenAddress TEXT NOT NULL,
      fromAddr TEXT NOT NULL,
      toAddr TEXT NOT NULL,
      amount TEXT NOT NULL,
      FOREIGN KEY (txHash) REFERENCES transactions(hash)
    );

    -- NFT transfers (ERC-721 and ERC-1155)
    CREATE TABLE IF NOT EXISTS nft_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      txHash TEXT NOT NULL,
      blockNumber INTEGER NOT NULL,
      logIndex INTEGER NOT NULL,
      contractAddress TEXT NOT NULL,
      fromAddr TEXT NOT NULL,
      toAddr TEXT NOT NULL,
      tokenId TEXT NOT NULL,
      amount TEXT DEFAULT '1',
      standard TEXT NOT NULL,
      FOREIGN KEY (txHash) REFERENCES transactions(hash)
    );

    -- DEX swaps
    CREATE TABLE IF NOT EXISTS dex_swaps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      txHash TEXT NOT NULL,
      blockNumber INTEGER NOT NULL,
      logIndex INTEGER NOT NULL,
      dexName TEXT NOT NULL,
      poolAddress TEXT NOT NULL,
      sender TEXT,
      recipient TEXT,
      token0In TEXT,
      token1In TEXT,
      token0Out TEXT,
      token1Out TEXT,
      FOREIGN KEY (txHash) REFERENCES transactions(hash)
    );

    -- Contract deployments
    CREATE TABLE IF NOT EXISTS contract_deployments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      txHash TEXT NOT NULL,
      blockNumber INTEGER NOT NULL,
      deployer TEXT NOT NULL,
      contractAddress TEXT NOT NULL,
      gasUsed TEXT,
      FOREIGN KEY (txHash) REFERENCES transactions(hash)
    );

    -- Known contract labels
    CREATE TABLE IF NOT EXISTS contract_labels (
      address TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      protocol TEXT
    );

    -- Daily aggregates (for fast stats queries)
    CREATE TABLE IF NOT EXISTS daily_stats (
      date TEXT PRIMARY KEY,
      totalBlocks INTEGER,
      totalTxs INTEGER,
      totalLogs INTEGER,
      totalGasUsed TEXT,
      uniqueFromAddresses INTEGER,
      uniqueToAddresses INTEGER,
      ethTransfers INTEGER,
      contractCalls INTEGER,
      contractCreations INTEGER,
      tokenTransfers INTEGER,
      nftTransfers INTEGER,
      dexSwaps INTEGER,
      avgGasPrice TEXT,
      avgBlockTime REAL
    );

    -- Checkpoint
    CREATE TABLE IF NOT EXISTS checkpoint (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      lastBlock INTEGER NOT NULL
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_logs_topic0 ON logs(topic0);
    CREATE INDEX IF NOT EXISTS idx_logs_address ON logs(address);
    CREATE INDEX IF NOT EXISTS idx_tx_block ON transactions(blockNumber);
    CREATE INDEX IF NOT EXISTS idx_tx_from ON transactions(fromAddr);
    CREATE INDEX IF NOT EXISTS idx_tx_to ON transactions(toAddr);
    CREATE INDEX IF NOT EXISTS idx_token_transfers_block ON token_transfers(blockNumber);
    CREATE INDEX IF NOT EXISTS idx_token_transfers_token ON token_transfers(tokenAddress);
    CREATE INDEX IF NOT EXISTS idx_nft_transfers_block ON nft_transfers(blockNumber);
    CREATE INDEX IF NOT EXISTS idx_dex_swaps_block ON dex_swaps(blockNumber);
    CREATE INDEX IF NOT EXISTS idx_dex_swaps_pool ON dex_swaps(poolAddress);
    CREATE INDEX IF NOT EXISTS idx_blocks_timestamp ON blocks(timestamp);
  `);
}