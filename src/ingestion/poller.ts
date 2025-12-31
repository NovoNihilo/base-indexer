import { cfg } from '../config.js';
import {
  db,
  stmts,
  getLastProcessedBlock,
  setLastProcessedBlock,
} from '../storage/db.js';
import {
  fetchBlockWithTxs,
  fetchBlockReceipts,
  fetchReceiptsIndividually,
  getLatestBlockNumber,
} from './fetcher.js';
import { computeBlockMetrics } from '../parsing/metrics.js';

let useBatchReceipts = true;
let isShuttingDown = false;
let blocksProcessedSinceStart = 0;
let startTime = Date.now();

// Health stats (exported for monitoring)
export const healthStats = {
  lastBlockProcessed: 0n,
  lastBlockTimestamp: 0,
  blocksProcessed: 0,
  errors: 0,
  isRunning: false,
  startedAt: 0,
  catchingUp: false,
  blocksBehind: 0,
};

async function handleReorg(currentBlock: bigint): Promise<bigint> {
  const prevRow = stmts.getBlockByNumber.get(Number(currentBlock - 1n)) as
    | { hash: string; parentHash: string }
    | undefined;

  if (!prevRow) return currentBlock;

  const block = await fetchBlockWithTxs(currentBlock);
  if (block.parentHash.toLowerCase() !== prevRow.hash.toLowerCase()) {
    console.log(`\n⚠️  Reorg detected at block ${currentBlock}`);
    const rewindTo = currentBlock - BigInt(cfg.REORG_REWIND_DEPTH);
    stmts.markReorged.run(Number(rewindTo));
    
    const rewindNum = Number(rewindTo);
    db.exec(`
      DELETE FROM logs WHERE blockNumber >= ${rewindNum};
      DELETE FROM receipts WHERE blockNumber >= ${rewindNum};
      DELETE FROM transactions WHERE blockNumber >= ${rewindNum};
      DELETE FROM block_metrics WHERE blockNumber >= ${rewindNum};
      DELETE FROM event_counts WHERE blockNumber >= ${rewindNum};
      DELETE FROM token_transfers WHERE blockNumber >= ${rewindNum};
      DELETE FROM nft_transfers WHERE blockNumber >= ${rewindNum};
      DELETE FROM dex_swaps WHERE blockNumber >= ${rewindNum};
      DELETE FROM contract_deployments WHERE blockNumber >= ${rewindNum};
    `);
    
    setLastProcessedBlock(rewindTo - 1n);
    return rewindTo;
  }
  return currentBlock;
}

function parseHexBigInt(val: any): bigint {
  if (typeof val === 'bigint') return val;
  if (typeof val === 'string') return BigInt(val);
  if (typeof val === 'number') return BigInt(val);
  return 0n;
}

async function processBlock(blockNumber: bigint): Promise<{ txCount: number; logCount: number; swapCount: number }> {
  const block = await fetchBlockWithTxs(blockNumber);
  
  const txs = block.transactions.filter(
    (tx): tx is Exclude<typeof tx, string> => typeof tx !== 'string'
  );

  // Try batch receipts first
  let receipts: any[] | null = null;
  if (useBatchReceipts) {
    receipts = await fetchBlockReceipts(blockNumber);
    if (receipts === null) {
      console.log('\n⚠️  Batch receipts not supported, using individual fetches');
      useBatchReceipts = false;
    }
  }

  if (!receipts) {
    const txHashes = txs.map(tx => tx.hash);
    receipts = await fetchReceiptsIndividually(txHashes);
  }

  // Create receipt map
  const receiptMap = new Map<string, any>();
  for (const receipt of receipts) {
    if (receipt?.transactionHash) {
      receiptMap.set(receipt.transactionHash.toLowerCase(), receipt);
    }
  }

  // Insert block
  stmts.insertBlock.run(
    Number(block.number),
    block.hash,
    block.parentHash,
    Number(block.timestamp),
    block.gasUsed.toString(),
    block.gasLimit.toString(),
    block.baseFeePerGas?.toString() ?? null
  );

  const allLogs: any[] = [];
  const txData: any[] = [];

  for (const tx of txs) {
    const receipt = receiptMap.get(tx.hash.toLowerCase());
    const gasUsed = receipt ? parseHexBigInt(receipt.gasUsed) : 0n;
    const effectiveGasPrice = receipt ? parseHexBigInt(receipt.effectiveGasPrice || receipt.gasPrice || tx.gasPrice) : 0n;

    // Determine tx type
    let txType = 'legacy';
    if (tx.type === 'eip1559' || tx.maxFeePerGas) txType = 'eip1559';
    else if (tx.type === 'eip2930' || tx.accessList) txType = 'eip2930';

    stmts.insertTx.run(
      tx.hash,
      Number(block.number),
      tx.from,
      tx.to ?? null,
      tx.value.toString(),
      tx.input,
      tx.gasPrice?.toString() ?? null,
      tx.maxFeePerGas?.toString() ?? null,
      tx.maxPriorityFeePerGas?.toString() ?? null,
      gasUsed.toString(),
      effectiveGasPrice.toString(),
      txType
    );

    // Track contract deployments
    if (tx.to === null && receipt?.contractAddress) {
      stmts.insertContractDeployment.run(
        tx.hash,
        Number(block.number),
        tx.from,
        receipt.contractAddress,
        gasUsed.toString()
      );
    }

    if (receipt) {
      const status = receipt.status === 'success' || receipt.status === '0x1' || receipt.status === 1 ? 1 : 0;
      
      stmts.insertReceipt.run(
        receipt.transactionHash,
        Number(block.number),
        status,
        gasUsed.toString(),
        (receipt.logs || []).length,
        receipt.contractAddress ?? null,
        effectiveGasPrice.toString()
      );

      for (const rawLog of receipt.logs || []) {
        const logIndex = typeof rawLog.logIndex === 'string' 
          ? parseInt(rawLog.logIndex, 16) 
          : (rawLog.logIndex ?? 0);

        stmts.insertLog.run(
          receipt.transactionHash,
          Number(block.number),
          logIndex,
          rawLog.address,
          rawLog.topics?.[0] ?? null,
          rawLog.topics?.[1] ?? null,
          rawLog.topics?.[2] ?? null,
          rawLog.topics?.[3] ?? null,
          rawLog.data
        );

        allLogs.push({
          txHash: receipt.transactionHash,
          logIndex,
          address: rawLog.address,
          topics: rawLog.topics || [],
          data: rawLog.data,
        });
      }

      txData.push({
        hash: tx.hash,
        from: tx.from,
        to: tx.to ?? null,
        value: tx.value,
        input: tx.input,
        gasUsed,
        effectiveGasPrice,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
      });
    }
  }

  // Compute metrics and enriched data
  const { metrics, enriched } = computeBlockMetrics(txData, allLogs, Number(block.number));

  // Insert block metrics
  stmts.insertBlockMetrics.run(
    Number(block.number),
    metrics.txCount,
    metrics.logCount,
    metrics.gasUsed.toString(),
    metrics.avgGasPerTx?.toString() ?? null,
    JSON.stringify(metrics.topContracts),
    metrics.uniqueFromAddresses,
    metrics.uniqueToAddresses,
    metrics.avgGasPrice?.toString() ?? null,
    metrics.avgPriorityFee?.toString() ?? null
  );

  // Insert event counts
  for (const [eventType, count] of Object.entries(metrics.eventCounts)) {
    if (count > 0) {
      stmts.insertEventCount.run(Number(block.number), eventType, count);
    }
  }

  // Insert enriched data
  for (const transfer of enriched.tokenTransfers) {
    stmts.insertTokenTransfer.run(
      transfer.txHash,
      Number(block.number),
      transfer.logIndex,
      transfer.tokenAddress,
      transfer.from,
      transfer.to,
      transfer.amount
    );
  }

  for (const nft of enriched.nftTransfers) {
    stmts.insertNftTransfer.run(
      nft.txHash,
      Number(block.number),
      nft.logIndex,
      nft.contractAddress,
      nft.from,
      nft.to,
      nft.tokenId,
      nft.amount,
      nft.standard
    );
  }

  for (const swap of enriched.dexSwaps) {
    stmts.insertDexSwap.run(
      swap.txHash,
      Number(block.number),
      swap.logIndex,
      swap.dexName,
      swap.poolAddress,
      swap.sender,
      swap.recipient,
      swap.token0In,
      swap.token1In,
      swap.token0Out,
      swap.token1Out
    );
  }

  setLastProcessedBlock(blockNumber);
  
  // Update health stats
  healthStats.lastBlockProcessed = blockNumber;
  healthStats.lastBlockTimestamp = Date.now();
  healthStats.blocksProcessed++;
  blocksProcessedSinceStart++;
  
  return {
    txCount: metrics.txCount,
    logCount: metrics.logCount,
    swapCount: enriched.dexSwaps.length,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Graceful shutdown handler
function setupShutdownHandlers() {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    console.log(`\n\n🛑 Received ${signal}. Shutting down gracefully...`);
    console.log(`📊 Processed ${blocksProcessedSinceStart} blocks this session`);
    console.log(`⏱️  Runtime: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)} minutes`);
    
    healthStats.isRunning = false;
    
    // Give current block time to finish
    await sleep(500);
    
    console.log('✅ Shutdown complete\n');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

export async function startPoller() {
  setupShutdownHandlers();
  
  let lastProcessed: bigint | null = getLastProcessedBlock();
  startTime = Date.now();
  healthStats.startedAt = startTime;
  healthStats.isRunning = true;

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           🔗 Base Indexer - Starting Up                    ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║  Press Ctrl+C for graceful shutdown                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (lastProcessed === null) {
    const latest = await getLatestBlockNumber();
    lastProcessed = latest - BigInt(cfg.SAFETY_BUFFER_BLOCKS);
    console.log(`🚀 First run. Starting from block ${lastProcessed}`);
  } else {
    console.log(`🔄 Resuming from block ${lastProcessed + 1n}`);
  }

  // Check how far behind we are
  const latestOnStart = await getLatestBlockNumber();
  const blocksBehind = Number(latestOnStart - lastProcessed);
  if (blocksBehind > 10) {
    console.log(`⚡ Catch-up mode: ${blocksBehind} blocks behind\n`);
    healthStats.catchingUp = true;
  } else {
    console.log('');
  }

  while (!isShuttingDown) {
    try {
      const latestHead = await getLatestBlockNumber();
      const safeHead = latestHead - BigInt(cfg.SAFETY_BUFFER_BLOCKS);
      const nextBlock: bigint = lastProcessed + 1n;
      
      const currentBehind = Number(safeHead - lastProcessed);
      healthStats.blocksBehind = currentBehind;

      // If we're caught up, wait for new blocks
      if (nextBlock > safeHead) {
        healthStats.catchingUp = false;
        await sleep(cfg.POLL_INTERVAL_MS);
        continue;
      }

      // Check for reorg
      const processFrom = await handleReorg(nextBlock);
      if (processFrom < nextBlock) {
        lastProcessed = processFrom - 1n;
        continue;
      }

      // CATCH-UP MODE: Process without sleeping when behind
      healthStats.catchingUp = currentBehind > 5;
      
      const result = await processBlock(nextBlock);
      lastProcessed = nextBlock;
      
      // Log progress
      if (currentBehind > 10) {
        // Heavy catch-up: update same line
        const blocksPerSec = blocksProcessedSinceStart / ((Date.now() - startTime) / 1000);
        const eta = currentBehind / blocksPerSec;
        process.stdout.write(
          `\r⚡ Block ${nextBlock} | ${currentBehind} behind | ${blocksPerSec.toFixed(1)} blk/s | ETA: ${eta.toFixed(0)}s   `
        );
      } else {
        // Near caught up or caught up: normal logging (new line each block)
        if (healthStats.catchingUp) {
          // Print newline to clear the catch-up line
          console.log('');
          healthStats.catchingUp = false;
        }
        console.log(
          `✓ Block ${nextBlock} | tx: ${result.txCount} | logs: ${result.logCount} | swaps: ${result.swapCount}`
        );
      }

      // Only sleep if we're caught up (within 5 blocks)
      if (currentBehind <= 5) {
        await sleep(cfg.POLL_INTERVAL_MS);
      }
      
    } catch (err) {
      healthStats.errors++;
      console.error('\n❌ Error:', (err as Error).message);
      await sleep(cfg.POLL_INTERVAL_MS * 2);
    }
  }
}

// Health check function
export function getHealthStatus() {
  const uptime = Date.now() - healthStats.startedAt;
  const blocksPerSecond = uptime > 0 ? healthStats.blocksProcessed / (uptime / 1000) : 0;
  
  return {
    status: healthStats.isRunning ? 'running' : 'stopped',
    lastBlock: healthStats.lastBlockProcessed.toString(),
    blocksProcessed: healthStats.blocksProcessed,
    blocksBehind: healthStats.blocksBehind,
    catchingUp: healthStats.catchingUp,
    errors: healthStats.errors,
    uptimeSeconds: Math.floor(uptime / 1000),
    blocksPerSecond: blocksPerSecond.toFixed(2),
  };
}