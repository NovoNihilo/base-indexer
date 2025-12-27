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

async function processBlock(blockNumber: bigint) {
  const block = await fetchBlockWithTxs(blockNumber);
  
  const txs = block.transactions.filter(
    (tx): tx is Exclude<typeof tx, string> => typeof tx !== 'string'
  );

  // Try batch receipts first
  let receipts: any[] | null = null;
  if (useBatchReceipts) {
    receipts = await fetchBlockReceipts(blockNumber);
    if (receipts === null) {
      console.log('⚠️  Batch receipts not supported, using individual fetches');
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
  
  const swapCount = enriched.dexSwaps.length;
  const transferCount = enriched.tokenTransfers.length;
  console.log(
    `✓ Block ${block.number} | txs: ${metrics.txCount} | logs: ${metrics.logCount} | swaps: ${swapCount} | transfers: ${transferCount}`
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function startPoller() {
  let lastProcessed: bigint | null = getLastProcessedBlock();

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
      const nextBlock: bigint = lastProcessed + 1n;

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
