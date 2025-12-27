import { db } from '../storage/db.js';

interface BlockRow {
  number: number;
  timestamp: number;
}

interface EventRow {
  eventType: string;
  total: number;
}

interface HourlyRow {
  hour: number;
  txCount: number;
  logCount: number;
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

function getUTCDateString(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toISOString().split('T')[0];
}

function getUTCHour(timestamp: number): number {
  const date = new Date(timestamp * 1000);
  return date.getUTCHours();
}

function printDailyStats(targetDate?: string) {
  // If no date provided, use the last complete UTC day
  const now = new Date();
  const todayUTC = now.toISOString().split('T')[0];
  
  let dateToAnalyze: string;
  
  if (targetDate) {
    dateToAnalyze = targetDate;
  } else {
    // Get yesterday UTC
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    dateToAnalyze = yesterday.toISOString().split('T')[0];
  }

  // Calculate UTC timestamps for start and end of day
  const startOfDay = new Date(dateToAnalyze + 'T00:00:00Z').getTime() / 1000;
  const endOfDay = new Date(dateToAnalyze + 'T23:59:59Z').getTime() / 1000;

  // Check if we have data for this day
  const blockCount = db
    .prepare(`SELECT COUNT(*) as count FROM blocks WHERE timestamp >= ? AND timestamp <= ? AND reorged = 0`)
    .get(startOfDay, endOfDay) as { count: number };

  if (blockCount.count === 0) {
    console.log(`\n❌ No data found for ${dateToAnalyze} UTC`);
    console.log(`   Make sure the indexer has been running long enough to capture this day.`);
    
    // Show what data we do have
    const range = db
      .prepare(`SELECT MIN(timestamp) as minTs, MAX(timestamp) as maxTs FROM blocks WHERE reorged = 0`)
      .get() as { minTs: number; maxTs: number };
    
    if (range.minTs) {
      console.log(`\n   Available data range:`);
      console.log(`   From: ${new Date(range.minTs * 1000).toISOString()}`);
      console.log(`   To:   ${new Date(range.maxTs * 1000).toISOString()}`);
    }
    return;
  }

  // Get blocks for this day
  const blocks = db
    .prepare(`
      SELECT number, timestamp 
      FROM blocks 
      WHERE timestamp >= ? AND timestamp <= ? AND reorged = 0 
      ORDER BY number ASC
    `)
    .all(startOfDay, endOfDay) as BlockRow[];

  const firstBlock = blocks[0];
  const lastBlock = blocks[blocks.length - 1];

  // Calculate avg block time
  const timeSpan = lastBlock.timestamp - firstBlock.timestamp;
  const avgBlockTime = blocks.length > 1 ? timeSpan / (blocks.length - 1) : 2;

  // Get aggregate metrics
  const metrics = db
    .prepare(`
      SELECT 
        SUM(txCount) as txCount, 
        SUM(logCount) as logCount,
        SUM(CAST(gasUsed AS INTEGER)) as totalGas
      FROM block_metrics 
      WHERE blockNumber >= ? AND blockNumber <= ?
    `)
    .get(firstBlock.number, lastBlock.number) as { txCount: number; logCount: number; totalGas: number };

  // Event classification
  const events = db
    .prepare(`
      SELECT eventType, SUM(count) as total 
      FROM event_counts 
      WHERE blockNumber >= ? AND blockNumber <= ? 
      GROUP BY eventType
      ORDER BY total DESC
    `)
    .all(firstBlock.number, lastBlock.number) as EventRow[];

  // Top contracts
  const contractCounts = new Map<string, number>();
  const metricRows = db
    .prepare(`SELECT topContracts FROM block_metrics WHERE blockNumber >= ? AND blockNumber <= ?`)
    .all(firstBlock.number, lastBlock.number) as { topContracts: string }[];

  for (const row of metricRows) {
    const contracts = JSON.parse(row.topContracts || '[]') as { address: string; count: number }[];
    for (const c of contracts) {
      contractCounts.set(c.address, (contractCounts.get(c.address) || 0) + c.count);
    }
  }

  const topContracts = [...contractCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Hourly breakdown
  const hourlyData = new Map<number, { txCount: number; logCount: number }>();
  for (let h = 0; h < 24; h++) {
    hourlyData.set(h, { txCount: 0, logCount: 0 });
  }

  const hourlyBlocks = db
    .prepare(`
      SELECT b.timestamp, bm.txCount, bm.logCount
      FROM blocks b
      JOIN block_metrics bm ON b.number = bm.blockNumber
      WHERE b.timestamp >= ? AND b.timestamp <= ? AND b.reorged = 0
    `)
    .all(startOfDay, endOfDay) as { timestamp: number; txCount: number; logCount: number }[];

  for (const row of hourlyBlocks) {
    const hour = getUTCHour(row.timestamp);
    const existing = hourlyData.get(hour)!;
    existing.txCount += row.txCount;
    existing.logCount += row.logCount;
  }

  // Find peak hour
  let peakHour = 0;
  let peakTxCount = 0;
  for (const [hour, data] of hourlyData) {
    if (data.txCount > peakTxCount) {
      peakTxCount = data.txCount;
      peakHour = hour;
    }
  }

  // Print report
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           📊 BASE NETWORK DAILY STATS (UTC)                  ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Date: ${dateToAnalyze}                                       ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  console.log('\n📈 OVERVIEW');
  console.log('─'.repeat(50));
  console.log(`  Total Blocks:        ${formatNumber(blocks.length)}`);
  console.log(`  Block Range:         ${formatNumber(firstBlock.number)} → ${formatNumber(lastBlock.number)}`);
  console.log(`  Avg Block Time:      ${avgBlockTime.toFixed(2)}s`);
  console.log(`  Total Transactions:  ${formatNumber(metrics.txCount)}`);
  console.log(`  Total Logs:          ${formatNumber(metrics.logCount)}`);
  console.log(`  Total Gas Used:      ${formatNumber(metrics.totalGas)}`);
  console.log(`  Avg Tx/Block:        ${(metrics.txCount / blocks.length).toFixed(1)}`);
  console.log(`  Tx/Minute:           ${(metrics.txCount / (timeSpan / 60)).toFixed(1)}`);

  console.log('\n🏷️  TRANSACTION TYPES');
  console.log('─'.repeat(50));
  for (const e of events) {
    const pct = ((e.total / metrics.txCount) * 100).toFixed(1);
    console.log(`  ${e.eventType.padEnd(20)} ${formatNumber(e.total).padStart(12)}  (${pct}%)`);
  }

  console.log('\n⏰ PEAK ACTIVITY');
  console.log('─'.repeat(50));
  console.log(`  Busiest Hour (UTC):  ${peakHour.toString().padStart(2, '0')}:00 - ${(peakHour + 1).toString().padStart(2, '0')}:00`);
  console.log(`  Tx in Peak Hour:     ${formatNumber(peakTxCount)}`);

  console.log('\n🔥 TOP 10 CONTRACTS BY LOG COUNT');
  console.log('─'.repeat(50));
  let rank = 1;
  for (const [addr, count] of topContracts) {
    const pct = ((count / metrics.logCount) * 100).toFixed(1);
    console.log(`  ${rank.toString().padStart(2)}. ${addr}  ${formatNumber(count).padStart(8)} (${pct}%)`);
    rank++;
  }

  console.log('\n📊 HOURLY BREAKDOWN (UTC)');
  console.log('─'.repeat(50));
  
  // Simple ASCII bar chart
  const maxTx = Math.max(...[...hourlyData.values()].map(d => d.txCount));
  for (let h = 0; h < 24; h++) {
    const data = hourlyData.get(h)!;
    const barLen = maxTx > 0 ? Math.round((data.txCount / maxTx) * 20) : 0;
    const bar = '█'.repeat(barLen) + '░'.repeat(20 - barLen);
    console.log(`  ${h.toString().padStart(2)}:00 │${bar}│ ${formatNumber(data.txCount)}`);
  }

  console.log('\n');
}

// Parse command line args
const args = process.argv.slice(2);
let targetDate: string | undefined;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--date' && args[i + 1]) {
    targetDate = args[i + 1];
  }
}

// Also support: npm run stats 2024-01-15
if (!targetDate && args[0] && /^\d{4}-\d{2}-\d{2}$/.test(args[0])) {
  targetDate = args[0];
}

printDailyStats(targetDate);