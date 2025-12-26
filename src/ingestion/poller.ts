import { cfg } from '../config.js';
import {
  db,
  stmts,
  getLastProcessedBlock,
  setLastProcessedBlock,
} from '../storage/db.js';
import {
  fetchBlockWithTxs,
  fetchReceipts,
  getLatestBlockNumber,
} from './fetcher.js';
import { computeBlockMetrics } from '../parsing/metrics.js';
import type { Transaction } from 'viem';

async function handleReorg(currentBlock: bigint): Promise<bigint> {
  const prevRow = stmts.getBlockByNumber.get(Number(currentBlock - 1n)) as
    | { hash: string; parentHash: string }
    | undefined;

  if (!prevRow) return currentBlock;

  const block = await fetchBlockWithTxs(currentBlock);
  if (block.parentHash.toLowerCase() !== prevRow.hash.toLowerCase()) {
    console.log(`⚠️  Reorg detected at block ${currentBlock}`);
    const rewindTo = currentBlock - BigInt(cfg.REORG_REWIND_DEPTH);
    stmts.markReorged.run(Number(rewindTo));
    
    const rewindNum = Number(rewindTo);
    db.exec(`
      DELETE FROM logs WHERE blockNumber >= ${rewindNum};
      DELETE FROM receipts WHERE blockNumber >= ${rewindNum};
      DELETE FROM transactions WHERE blockNumber >= ${rewindNum};
      DELETE FROM block_metrics WHERE blockNumber >= ${rewindNum};
      DELETE FROM event_counts WHERE blockNumber >= ${rewindNum};
    `);
    
    setLastProcessedBlock(rewindTo - 1n);
    return rewindTo;
  }
  return currentBlock;
}

async function processBlock(blockNumber: bigint) {
  const block = await fetchBlockWithTxs(blockNumber);
  const txs = (block.transactions || []) as Transaction[];

  stmts.insertBlock.run(
    Number(block.number),
    block.hash,
    block.parentHash,
    Number(block.timestamp),
    block.gasUsed.toString(),
    block.gasLimit.toString(),
    block.baseFeePerGas?.toString() ?? null
  );

  for (const tx of txs) {
    stmts.insertTx.run(
      tx.hash,
      Number(block.number),
      tx.from,
      tx.to ?? null,
      tx.value.toString(),
      tx.input,
      tx.gasPrice?.toString() ?? null,
      tx.maxFeePerGas?.toString() ?? null,
      tx.maxPriorityFeePerGas?.toString() ?? null
    );
  }

  const receipts = await fetchReceipts(txs.map((tx) => tx.hash));
  const allLogs: any[] = [];

  for (const receipt of receipts) {
    stmts.insertReceipt.run(
      receipt.transactionHash,
      Number(block.number),
      receipt.status === 'success' ? 1 : 0,
      receipt.gasUsed.toString(),
      receipt.logs.length,
      receipt.contractAddress ?? null
    );

    for (const log of receipt.logs) {
      stmts.insertLog.run(
        receipt.transactionHash,
        Number(block.number),
        log.logIndex,
        log.address,
        log.topics[0] ?? null,
        log.topics[1] ?? null,
        log.topics[2] ?? null,
        log.topics[3] ?? null,
        log.data
      );
      allLogs.push(log);
    }
  }

  const txData = receipts.map((r, i) => ({
    hash: r.transactionHash,
    to: txs[i]?.to ?? null,
    value: txs[i]?.value ?? 0n,
    input: txs[i]?.input ?? '0x',
    gasUsed: r.gasUsed,
  }));

  const metrics = computeBlockMetrics(txData, allLogs);

  stmts.insertBlockMetrics.run(
    Number(block.number),
    metrics.txCount,
    metrics.logCount,
    metrics.gasUsed.toString(),
    metrics.avgGasPerTx?.toString() ?? null,
    JSON.stringify(metrics.topContracts)
  );

  for (const [eventType, count] of Object.entries(metrics.eventCounts)) {
    if (count > 0) {
      stmts.insertEventCount.run(Number(block.number), eventType, count);
    }
  }

  setLastProcessedBlock(blockNumber);
  console.log(
    `✓ Block ${block.number} | txs: ${metrics.txCount} | logs: ${metrics.logCount} | gas: ${metrics.gasUsed}`
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function startPoller() {
  let lastProcessed = getLastProcessedBlock();

  if (lastProcessed === null) {
    const latest = await getLatestBlockNumber();
    lastProcessed = latest - BigInt(cfg.SAFETY_BUFFER_BLOCKS);
    console.log(`🚀 First run. Starting from block ${lastProcessed}`);
  } else {
    console.log(`🔄 Resuming from block ${lastProcessed + 1n}`);
  }

  while (true) {
    try {
      const latestHead = await getLatestBlockNumber();
      const nextBlock = lastProcessed + 1n;

      if (nextBlock > latestHead) {
        await sleep(cfg.POLL_INTERVAL_MS);
        continue;
      }

      const processFrom = await handleReorg(nextBlock);
      if (processFrom < nextBlock) {
        lastProcessed = processFrom - 1n;
        continue;
      }

      await processBlock(nextBlock);
      lastProcessed = nextBlock;
    } catch (err) {
      console.error('❌ Error:', (err as Error).message);
      await sleep(cfg.POLL_INTERVAL_MS * 2);
    }
  }
}
