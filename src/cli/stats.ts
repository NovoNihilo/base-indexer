import { db } from '../storage/db.js';
import { cfg } from '../config.js';

const N = cfg.STATS_WINDOW_BLOCKS;

interface BlockRow {
  number: number;
  timestamp: number;
}

interface EventRow {
  eventType: string;
  total: number;
}

function printStats() {
  const blocks = db
    .prepare(
      `SELECT number, timestamp FROM blocks WHERE reorged = 0 ORDER BY number DESC LIMIT ?`
    )
    .all(N) as BlockRow[];

  if (blocks.length < 2) {
    console.log('Not enough blocks to compute stats. Run ingestor first.');
    return;
  }

  const newest = blocks[0];
  const oldest = blocks[blocks.length - 1];
  const timeSpan = newest.timestamp - oldest.timestamp;
  const avgBlockTime = timeSpan / (blocks.length - 1);

  const metrics = db
    .prepare(
      `SELECT SUM(txCount) as txCount, SUM(logCount) as logCount FROM block_metrics WHERE blockNumber >= ?`
    )
    .get(oldest.number) as { txCount: number; logCount: number };

  const txPerMin = timeSpan > 0 ? (metrics.txCount / timeSpan) * 60 : 0;

  const contractCounts = new Map<string, number>();
  const metricRows = db
    .prepare(`SELECT topContracts FROM block_metrics WHERE blockNumber >= ?`)
    .all(oldest.number) as { topContracts: string }[];

  for (const row of metricRows) {
    const contracts = JSON.parse(row.topContracts || '[]') as {
      address: string;
      count: number;
    }[];
    for (const c of contracts) {
      contractCounts.set(
        c.address,
        (contractCounts.get(c.address) || 0) + c.count
      );
    }
  }

  const topContracts = [...contractCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const events = db
    .prepare(
      `SELECT eventType, SUM(count) as total FROM event_counts WHERE blockNumber >= ? GROUP BY eventType`
    )
    .all(oldest.number) as EventRow[];

  console.log('\n📊 Base Indexer Stats');
  console.log('═'.repeat(50));
  console.log(`Blocks analyzed: ${blocks.length} (${oldest.number} → ${newest.number})`);
  console.log(`Avg block time: ${avgBlockTime.toFixed(2)}s`);
  console.log(`Tx/min: ${txPerMin.toFixed(2)}`);
  console.log(`Total txs: ${metrics.txCount}`);
  console.log(`Total logs: ${metrics.logCount}`);

  console.log('\n��️  Event Classification:');
  for (const e of events) {
    console.log(`  ${e.eventType}: ${e.total}`);
  }

  console.log('\n🔥 Top Contracts by Log Count:');
  for (const [addr, count] of topContracts) {
    console.log(`  ${addr}: ${count}`);
  }
  console.log('');
}

printStats();
