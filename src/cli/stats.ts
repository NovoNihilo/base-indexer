import { db } from '../storage/db.js';

interface BlockRow {
  number: number;
  timestamp: number;
}

interface EventRow {
  eventType: string;
  total: number;
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

function formatPct(value: number, total: number): string {
  if (total === 0) return '0.00%';
  const pct = (value / total) * 100;
  if (pct < 0.01 && pct > 0) return '<0.01%';
  if (pct < 0.1) return pct.toFixed(2) + '%';
  return pct.toFixed(1) + '%';
}

function formatChange(current: number, previous: number): string {
  if (previous === 0) return 'N/A';
  const change = ((current - previous) / previous) * 100;
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

function getUTCHour(timestamp: number): number {
  const date = new Date(timestamp * 1000);
  return date.getUTCHours();
}

function getLabel(addr: string): string | null {
  const row = db.prepare(`SELECT name FROM contract_labels WHERE address = ?`).get(addr.toLowerCase()) as { name: string } | undefined;
  return row?.name || null;
}

function formatAddressShort(addr: string): string {
  const label = getLabel(addr);
  if (label) {
    return label;
  }
  return addr;
}

function getDayStats(dateStr: string) {
  const startOfDay = new Date(dateStr + 'T00:00:00Z').getTime() / 1000;
  const endOfDay = new Date(dateStr + 'T23:59:59Z').getTime() / 1000;

  const blockCount = db
    .prepare(`SELECT COUNT(*) as count FROM blocks WHERE timestamp >= ? AND timestamp <= ? AND reorged = 0`)
    .get(startOfDay, endOfDay) as { count: number };

  if (blockCount.count === 0) return null;

  const blocks = db
    .prepare(`SELECT number, timestamp FROM blocks WHERE timestamp >= ? AND timestamp <= ? AND reorged = 0 ORDER BY number ASC`)
    .all(startOfDay, endOfDay) as BlockRow[];

  const firstBlock = blocks[0];
  const lastBlock = blocks[blocks.length - 1];

  const metrics = db
    .prepare(`SELECT SUM(txCount) as txCount, SUM(logCount) as logCount FROM block_metrics WHERE blockNumber >= ? AND blockNumber <= ?`)
    .get(firstBlock.number, lastBlock.number) as { txCount: number; logCount: number };

  const dexSwapCount = db
    .prepare(`SELECT COUNT(*) as count FROM dex_swaps WHERE blockNumber >= ? AND blockNumber <= ?`)
    .get(firstBlock.number, lastBlock.number) as { count: number };

  const tokenTransferCount = db
    .prepare(`SELECT COUNT(*) as count FROM token_transfers WHERE blockNumber >= ? AND blockNumber <= ?`)
    .get(firstBlock.number, lastBlock.number) as { count: number };

  const contractDeployCount = db
    .prepare(`SELECT COUNT(*) as count FROM contract_deployments WHERE blockNumber >= ? AND blockNumber <= ?`)
    .get(firstBlock.number, lastBlock.number) as { count: number };

  // Daily active addresses (unique fromAddr)
  const activeAddresses = db
    .prepare(`SELECT COUNT(DISTINCT fromAddr) as count FROM transactions WHERE blockNumber >= ? AND blockNumber <= ?`)
    .get(firstBlock.number, lastBlock.number) as { count: number };

  return {
    blocks: blocks.length,
    txCount: metrics.txCount,
    logCount: metrics.logCount,
    swaps: dexSwapCount.count,
    transfers: tokenTransferCount.count,
    deploys: contractDeployCount.count,
    activeAddresses: activeAddresses.count,
    firstBlock: firstBlock.number,
    lastBlock: lastBlock.number,
  };
}

function printDailyStats(targetDate?: string) {
  const now = new Date();
  
  let dateToAnalyze: string;
  
  if (targetDate) {
    dateToAnalyze = targetDate;
  } else {
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    dateToAnalyze = yesterday.toISOString().split('T')[0];
  }

  // Get previous day for comparison
  const prevDate = new Date(dateToAnalyze + 'T00:00:00Z');
  prevDate.setUTCDate(prevDate.getUTCDate() - 1);
  const prevDateStr = prevDate.toISOString().split('T')[0];

  const startOfDay = new Date(dateToAnalyze + 'T00:00:00Z').getTime() / 1000;
  const endOfDay = new Date(dateToAnalyze + 'T23:59:59Z').getTime() / 1000;

  const blockCount = db
    .prepare(`SELECT COUNT(*) as count FROM blocks WHERE timestamp >= ? AND timestamp <= ? AND reorged = 0`)
    .get(startOfDay, endOfDay) as { count: number };

  if (blockCount.count === 0) {
    console.log(`\n❌ No data found for ${dateToAnalyze} UTC`);
    console.log(`   Make sure the indexer has been running long enough to capture this day.`);
    
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

  const timeSpan = lastBlock.timestamp - firstBlock.timestamp;
  const avgBlockTime = blocks.length > 1 ? timeSpan / (blocks.length - 1) : 2;

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

  // Daily active addresses
  const activeAddresses = db
    .prepare(`SELECT COUNT(DISTINCT fromAddr) as count FROM transactions WHERE blockNumber >= ? AND blockNumber <= ?`)
    .get(firstBlock.number, lastBlock.number) as { count: number };

  // Get previous day stats for comparison
  const prevStats = getDayStats(prevDateStr);

  // Get ALL events for breakdown
  const events = db
    .prepare(`
      SELECT eventType, SUM(count) as total 
      FROM event_counts 
      WHERE blockNumber >= ? AND blockNumber <= ? 
      GROUP BY eventType
      ORDER BY total DESC
    `)
    .all(firstBlock.number, lastBlock.number) as EventRow[];

  // Separate transaction types from log/event types
  const txTypes = ['eth_transfer', 'contract_call', 'contract_creation'];
  const txEvents = events.filter(e => txTypes.includes(e.eventType));
  const logEvents = events.filter(e => !txTypes.includes(e.eventType));

  // Calculate totals for each category
  const totalTxEvents = txEvents.reduce((sum, e) => sum + e.total, 0);
  const totalLogEvents = logEvents.reduce((sum, e) => sum + e.total, 0);

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

  let peakHour = 0;
  let peakTxCount = 0;
  for (const [hour, data] of hourlyData) {
    if (data.txCount > peakTxCount) {
      peakTxCount = data.txCount;
      peakHour = hour;
    }
  }

  // Get enriched data counts
  const tokenTransferCount = db
    .prepare(`SELECT COUNT(*) as count FROM token_transfers WHERE blockNumber >= ? AND blockNumber <= ?`)
    .get(firstBlock.number, lastBlock.number) as { count: number };

  const nftTransferCount = db
    .prepare(`SELECT COUNT(*) as count FROM nft_transfers WHERE blockNumber >= ? AND blockNumber <= ?`)
    .get(firstBlock.number, lastBlock.number) as { count: number };

  const dexSwapCount = db
    .prepare(`SELECT COUNT(*) as count FROM dex_swaps WHERE blockNumber >= ? AND blockNumber <= ?`)
    .get(firstBlock.number, lastBlock.number) as { count: number };

  const contractDeployCount = db
    .prepare(`SELECT COUNT(*) as count FROM contract_deployments WHERE blockNumber >= ? AND blockNumber <= ?`)
    .get(firstBlock.number, lastBlock.number) as { count: number };

  // DEX breakdown
  const dexBreakdown = db
    .prepare(`
      SELECT dexName, COUNT(*) as count 
      FROM dex_swaps 
      WHERE blockNumber >= ? AND blockNumber <= ?
      GROUP BY dexName
      ORDER BY count DESC
    `)
    .all(firstBlock.number, lastBlock.number) as { dexName: string; count: number }[];

  // Top tokens by transfer count
  const topTokens = db
    .prepare(`
      SELECT tokenAddress, COUNT(*) as count 
      FROM token_transfers 
      WHERE blockNumber >= ? AND blockNumber <= ?
      GROUP BY tokenAddress
      ORDER BY count DESC
      LIMIT 10
    `)
    .all(firstBlock.number, lastBlock.number) as { tokenAddress: string; count: number }[];

  // Print report
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                              📊 BASE NETWORK DAILY STATS (UTC)                                   ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════════════════════════╣');
  console.log(`║  Date: ${dateToAnalyze}                                                                                ║`);
  console.log('╚══════════════════════════════════════════════════════════════════════════════════════════════════╝');
  
  console.log('\n📈 OVERVIEW');
  console.log('─'.repeat(100));
  console.log(`  Total Blocks:        ${formatNumber(blocks.length)}`);
  console.log(`  Block Range:         ${formatNumber(firstBlock.number)} → ${formatNumber(lastBlock.number)}`);
  console.log(`  Avg Block Time:      ${avgBlockTime.toFixed(2)}s`);
  
  const txChange = prevStats ? ` (${formatChange(metrics.txCount, prevStats.txCount)})` : '';
  console.log(`  Total Transactions:  ${formatNumber(metrics.txCount)}${txChange}`);
  
  const addrChange = prevStats ? ` (${formatChange(activeAddresses.count, prevStats.activeAddresses)})` : '';
  console.log(`  Active Addresses:    ${formatNumber(activeAddresses.count)}${addrChange}`);
  
  console.log(`  Total Logs:          ${formatNumber(metrics.logCount)}`);
  console.log(`  Total Gas Used:      ${formatNumber(metrics.totalGas)}`);
  console.log(`  Avg Tx/Block:        ${(metrics.txCount / blocks.length).toFixed(1)}`);
  console.log(`  Tx/Minute:           ${(metrics.txCount / (timeSpan / 60)).toFixed(1)}`);

  console.log('\n🔀 TRANSACTION TYPES');
  console.log('─'.repeat(100));
  for (const e of txEvents) {
    const pct = formatPct(e.total, totalTxEvents);
    console.log(`  ${e.eventType.padEnd(25)} ${formatNumber(e.total).padStart(15)}  (${pct.padStart(8)})`);
  }

  console.log('\n📋 EVENT TYPES (from logs)');
  console.log('─'.repeat(100));
  for (const e of logEvents.slice(0, 20)) {
    const pct = formatPct(e.total, totalLogEvents);
    console.log(`  ${e.eventType.padEnd(25)} ${formatNumber(e.total).padStart(15)}  (${pct.padStart(8)})`);
  }

  console.log('\n💱 DEX ACTIVITY');
  console.log('─'.repeat(100));
  const swapChange = prevStats ? ` (${formatChange(dexSwapCount.count, prevStats.swaps)})` : '';
  console.log(`  Total Swaps:         ${formatNumber(dexSwapCount.count)}${swapChange}`);
  for (const dex of dexBreakdown) {
    const pct = formatPct(dex.count, dexSwapCount.count);
    console.log(`    ${dex.dexName.padEnd(22)} ${formatNumber(dex.count).padStart(12)}  (${pct.padStart(8)})`);
  }

  console.log('\n🪙 TOP 10 TOKENS BY TRANSFER COUNT');
  console.log('─'.repeat(100));
  console.log(`  Total ERC-20 Transfers: ${formatNumber(tokenTransferCount.count)}`);
  console.log(`  Total NFT Transfers:    ${formatNumber(nftTransferCount.count)}`);
  console.log('');
  let tokenRank = 1;
  for (const token of topTokens) {
    const label = getLabel(token.tokenAddress);
    const pct = formatPct(token.count, tokenTransferCount.count);
    if (label) {
      console.log(`  ${tokenRank.toString().padStart(2)}. ${label.padEnd(15)} ${token.tokenAddress}  ${formatNumber(token.count).padStart(12)} (${pct.padStart(7)})`);
    } else {
      console.log(`  ${tokenRank.toString().padStart(2)}. ${''.padEnd(15)} ${token.tokenAddress}  ${formatNumber(token.count).padStart(12)} (${pct.padStart(7)})`);
    }
    tokenRank++;
  }

  console.log('\n🏗️  CONTRACT DEPLOYMENTS');
  console.log('─'.repeat(100));
  console.log(`  New Contracts:       ${formatNumber(contractDeployCount.count)}`);

  console.log('\n⏰ PEAK ACTIVITY');
  console.log('─'.repeat(100));
  console.log(`  Busiest Hour (UTC):  ${peakHour.toString().padStart(2, '0')}:00 - ${(peakHour + 1).toString().padStart(2, '0')}:00`);
  console.log(`  Tx in Peak Hour:     ${formatNumber(peakTxCount)}`);

  console.log('\n🔥 TOP 10 CONTRACTS BY LOG COUNT');
  console.log('─'.repeat(100));
  let rank = 1;
  for (const [addr, count] of topContracts) {
    const pct = formatPct(count, metrics.logCount);
    const label = getLabel(addr);
    if (label) {
      console.log(`  ${rank.toString().padStart(2)}. ${label.padEnd(25)} ${addr}  ${formatNumber(count).padStart(12)} (${pct.padStart(7)})`);
    } else {
      console.log(`  ${rank.toString().padStart(2)}. ${''.padEnd(25)} ${addr}  ${formatNumber(count).padStart(12)} (${pct.padStart(7)})`);
    }
    rank++;
  }

  console.log('\n📊 HOURLY BREAKDOWN (UTC)');
  console.log('─'.repeat(100));
  
  const maxTx = Math.max(...[...hourlyData.values()].map(d => d.txCount));
  for (let h = 0; h < 24; h++) {
    const data = hourlyData.get(h)!;
    const barLen = maxTx > 0 ? Math.round((data.txCount / maxTx) * 30) : 0;
    const bar = '█'.repeat(barLen) + '░'.repeat(30 - barLen);
    console.log(`  ${h.toString().padStart(2)}:00 │${bar}│ ${formatNumber(data.txCount).padStart(10)}`);
  }

  // Twitter-ready output
  console.log('\n');
  console.log('═'.repeat(100));
  console.log('📱 TWITTER-READY FORMAT (copy below):');
  console.log('═'.repeat(100));
  console.log('');
  
  const tweetTxChange = prevStats ? ` (${formatChange(metrics.txCount, prevStats.txCount)} vs yesterday)` : '';
  const tweetAddrChange = prevStats ? ` (${formatChange(activeAddresses.count, prevStats.activeAddresses)})` : '';
  
  console.log(`📊 Base Network Daily Stats - ${dateToAnalyze}`);
  console.log('');
  console.log(`🔢 ${formatNumber(metrics.txCount)} transactions${tweetTxChange}`);
  console.log(`👥 ${formatNumber(activeAddresses.count)} active addresses${tweetAddrChange}`);
  console.log(`💱 ${formatNumber(dexSwapCount.count)} DEX swaps`);
  console.log(`🏗️ ${formatNumber(contractDeployCount.count)} new contracts`);
  console.log('');
  console.log('Top DEX Swaps:');
  for (const dex of dexBreakdown.slice(0, 3)) {
    const pct = formatPct(dex.count, dexSwapCount.count);
    console.log(`• ${dex.dexName}: ${formatNumber(dex.count)} (${pct})`);
  }
  console.log('');
  console.log('🔥 Top tokens by transfers:');
  for (const token of topTokens.slice(0, 5)) {
    const label = getLabel(token.tokenAddress) || token.tokenAddress.slice(0, 10) + '...';
    console.log(`• ${label}: ${formatNumber(token.count)}`);
  }
  console.log('');
  console.log(`⏰ Peak hour: ${peakHour.toString().padStart(2, '0')}:00 UTC`);
  console.log('');
}

// Parse command line args
const args = process.argv.slice(2);
let targetDate: string | undefined;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--date' && args[i + 1]) {
    targetDate = args[i + 1];
  }
}

if (!targetDate && args[0] && /^\d{4}-\d{2}-\d{2}$/.test(args[0])) {
  targetDate = args[0];
}

printDailyStats(targetDate);