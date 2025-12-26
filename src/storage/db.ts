import Database from 'better-sqlite3';
import { cfg } from '../config.js';
import { createTables } from './schema.js';

export const db = new Database(cfg.DB_PATH);
db.pragma('journal_mode = WAL');
createTables(db);

export const stmts = {
  insertBlock: db.prepare(`
    INSERT OR REPLACE INTO blocks (number, hash, parentHash, timestamp, gasUsed, gasLimit, baseFeePerGas, reorged)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `),
  insertTx: db.prepare(`
    INSERT OR IGNORE INTO transactions (hash, blockNumber, fromAddr, toAddr, value, input, gasPrice, maxFeePerGas, maxPriorityFeePerGas)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  insertReceipt: db.prepare(`
    INSERT OR IGNORE INTO receipts (txHash, blockNumber, status, gasUsed, logCount, contractAddress)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  insertLog: db.prepare(`
    INSERT INTO logs (txHash, blockNumber, logIndex, address, topic0, topic1, topic2, topic3, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  insertBlockMetrics: db.prepare(`
    INSERT OR REPLACE INTO block_metrics (blockNumber, txCount, logCount, gasUsed, avgGasPerTx, topContracts)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  insertEventCount: db.prepare(`
    INSERT OR REPLACE INTO event_counts (blockNumber, eventType, count)
    VALUES (?, ?, ?)
  `),
  getCheckpoint: db.prepare(`SELECT lastBlock FROM checkpoint WHERE id = 1`),
  setCheckpoint: db.prepare(`INSERT OR REPLACE INTO checkpoint (id, lastBlock) VALUES (1, ?)`),
  getBlockByNumber: db.prepare(`SELECT hash, parentHash FROM blocks WHERE number = ? AND reorged = 0`),
  markReorged: db.prepare(`UPDATE blocks SET reorged = 1 WHERE number >= ?`),
};

export function getLastProcessedBlock(): bigint | null {
  const row = stmts.getCheckpoint.get() as { lastBlock: number } | undefined;
  return row ? BigInt(row.lastBlock) : null;
}

export function setLastProcessedBlock(n: bigint) {
  stmts.setCheckpoint.run(Number(n));
}
