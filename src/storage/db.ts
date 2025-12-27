import Database from 'better-sqlite3';
import { cfg } from '../config.js';
import { createTables } from './schema.js';

export const db = new Database(cfg.DB_PATH);
db.pragma('journal_mode = WAL');
createTables(db);

export const stmts = {
  // Core inserts
  insertBlock: db.prepare(`
    INSERT OR REPLACE INTO blocks (number, hash, parentHash, timestamp, gasUsed, gasLimit, baseFeePerGas, reorged)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `),
  insertTx: db.prepare(`
    INSERT OR IGNORE INTO transactions (hash, blockNumber, fromAddr, toAddr, value, input, gasPrice, maxFeePerGas, maxPriorityFeePerGas, gasUsed, effectiveGasPrice, txType)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  insertReceipt: db.prepare(`
    INSERT OR IGNORE INTO receipts (txHash, blockNumber, status, gasUsed, logCount, contractAddress, effectiveGasPrice)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  insertLog: db.prepare(`
    INSERT INTO logs (txHash, blockNumber, logIndex, address, topic0, topic1, topic2, topic3, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  insertBlockMetrics: db.prepare(`
    INSERT OR REPLACE INTO block_metrics (blockNumber, txCount, logCount, gasUsed, avgGasPerTx, topContracts, uniqueFromAddresses, uniqueToAddresses, avgGasPrice, avgPriorityFee)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  insertEventCount: db.prepare(`
    INSERT OR REPLACE INTO event_counts (blockNumber, eventType, count)
    VALUES (?, ?, ?)
  `),

  // New enriched data inserts
  insertTokenTransfer: db.prepare(`
    INSERT INTO token_transfers (txHash, blockNumber, logIndex, tokenAddress, fromAddr, toAddr, amount)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  insertNftTransfer: db.prepare(`
    INSERT INTO nft_transfers (txHash, blockNumber, logIndex, contractAddress, fromAddr, toAddr, tokenId, amount, standard)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  insertDexSwap: db.prepare(`
    INSERT INTO dex_swaps (txHash, blockNumber, logIndex, dexName, poolAddress, sender, recipient, token0In, token1In, token0Out, token1Out)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  insertContractDeployment: db.prepare(`
    INSERT INTO contract_deployments (txHash, blockNumber, deployer, contractAddress, gasUsed)
    VALUES (?, ?, ?, ?, ?)
  `),
  insertContractLabel: db.prepare(`
    INSERT OR REPLACE INTO contract_labels (address, name, category, protocol)
    VALUES (?, ?, ?, ?)
  `),
  insertDailyStats: db.prepare(`
    INSERT OR REPLACE INTO daily_stats (date, totalBlocks, totalTxs, totalLogs, totalGasUsed, uniqueFromAddresses, uniqueToAddresses, ethTransfers, contractCalls, contractCreations, tokenTransfers, nftTransfers, dexSwaps, avgGasPrice, avgBlockTime)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),

  // Lookups
  getCheckpoint: db.prepare(`SELECT lastBlock FROM checkpoint WHERE id = 1`),
  setCheckpoint: db.prepare(`INSERT OR REPLACE INTO checkpoint (id, lastBlock) VALUES (1, ?)`),
  getBlockByNumber: db.prepare(`SELECT hash, parentHash FROM blocks WHERE number = ? AND reorged = 0`),
  markReorged: db.prepare(`UPDATE blocks SET reorged = 1 WHERE number >= ?`),
  getContractLabel: db.prepare(`SELECT name, category, protocol FROM contract_labels WHERE address = ?`),
};

export function getLastProcessedBlock(): bigint | null {
  const row = stmts.getCheckpoint.get() as { lastBlock: number } | undefined;
  return row ? BigInt(row.lastBlock) : null;
}

export function setLastProcessedBlock(n: bigint) {
  stmts.setCheckpoint.run(Number(n));
}

// Seed known contract labels
export function seedContractLabels() {
  const labels = [
    // Tokens
    ['0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', 'USDC', 'token', 'Circle'],
    ['0x4200000000000000000000000000000000000006', 'WETH', 'token', 'Base'],
    ['0x50c5725949a6f0c72e6c4a641f24049a917db0cb', 'DAI', 'token', 'MakerDAO'],
    ['0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22', 'cbETH', 'token', 'Coinbase'],
    ['0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca', 'USDbC', 'token', 'Base'],
    ['0xb6fe221fe9eef5aba221c348ba20a1bf5e73624c', 'rETH', 'token', 'RocketPool'],
    
    // DEXes
    ['0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24', 'Uniswap V3 Router', 'dex', 'Uniswap'],
    ['0x2626664c2603336e57b271c5c0b26f421741e481', 'Uniswap V3 Router 2', 'dex', 'Uniswap'],
    ['0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad', 'Uniswap Universal Router', 'dex', 'Uniswap'],
    ['0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43', 'Aerodrome Router', 'dex', 'Aerodrome'],
    ['0x6cb442acf35158d5eda88fe602221b67b400be3e', 'Aerodrome V2 Router', 'dex', 'Aerodrome'],
    
    // Bridges
    ['0x4200000000000000000000000000000000000010', 'L2 Standard Bridge', 'bridge', 'Base'],
    ['0x4200000000000000000000000000000000000007', 'L2 Cross Domain Messenger', 'bridge', 'Base'],
    
    // System
    ['0x4200000000000000000000000000000000000015', 'L1 Block', 'system', 'Base'],
    ['0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001', 'L1 Block Attributes', 'system', 'Base'],
    ['0x420000000000000000000000000000000000000f', 'Gas Price Oracle', 'system', 'Base'],
  ];

  for (const [address, name, category, protocol] of labels) {
    stmts.insertContractLabel.run(address.toLowerCase(), name, category, protocol);
  }
}

// Run on startup
seedContractLabels();
