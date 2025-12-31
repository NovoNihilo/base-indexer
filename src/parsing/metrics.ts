import { classifyTx, classifyLog, type EventType } from './classifier.js';
import {
  decodeErc20Transfer,
  decodeErc721Transfer,
  decodeErc1155TransferSingle,
  decodeSwapV2,
  decodeSwapV3,
} from './decoder.js';
import { getDexName } from './pool-registry.js';

interface TxData {
  hash: string;
  to: string | null;
  from: string;
  value: bigint;
  input: string;
  gasUsed: bigint;
  effectiveGasPrice: bigint;
  maxPriorityFeePerGas?: bigint;
}

interface LogData {
  txHash: string;
  logIndex: number;
  address: string;
  topics: (string | null)[];
  data: string;
}

export interface BlockMetrics {
  txCount: number;
  logCount: number;
  gasUsed: bigint;
  avgGasPerTx: bigint | null;
  topContracts: { address: string; count: number }[];
  eventCounts: Record<string, number>;
  uniqueFromAddresses: number;
  uniqueToAddresses: number;
  avgGasPrice: bigint | null;
  avgPriorityFee: bigint | null;
}

export interface EnrichedData {
  tokenTransfers: {
    txHash: string;
    logIndex: number;
    tokenAddress: string;
    from: string;
    to: string;
    amount: string;
  }[];
  nftTransfers: {
    txHash: string;
    logIndex: number;
    contractAddress: string;
    from: string;
    to: string;
    tokenId: string;
    amount: string;
    standard: string;
  }[];
  dexSwaps: {
    txHash: string;
    logIndex: number;
    dexName: string;
    poolAddress: string;
    sender: string;
    recipient: string;
    token0In: string;
    token1In: string;
    token0Out: string;
    token1Out: string;
  }[];
  contractDeployments: {
    txHash: string;
    deployer: string;
    contractAddress: string;
    gasUsed: string;
  }[];
}

export function computeBlockMetrics(
  txs: TxData[],
  logs: LogData[],
  blockNumber: number
): { metrics: BlockMetrics; enriched: EnrichedData } {
  const eventCounts: Record<string, number> = {};
  const addEvent = (type: string) => {
    eventCounts[type] = (eventCounts[type] || 0) + 1;
  };

  // Track unique addresses
  const fromAddresses = new Set<string>();
  const toAddresses = new Set<string>();

  // Enriched data collections
  const tokenTransfers: EnrichedData['tokenTransfers'] = [];
  const nftTransfers: EnrichedData['nftTransfers'] = [];
  const dexSwaps: EnrichedData['dexSwaps'] = [];
  const contractDeployments: EnrichedData['contractDeployments'] = [];

  // Gas tracking
  let totalGasPrice = 0n;
  let totalPriorityFee = 0n;
  let priorityFeeCount = 0;

  // Process transactions
  for (const tx of txs) {
    const txType = classifyTx(tx);
    addEvent(txType);

    fromAddresses.add(tx.from.toLowerCase());
    if (tx.to) toAddresses.add(tx.to.toLowerCase());

    totalGasPrice += tx.effectiveGasPrice;
    if (tx.maxPriorityFeePerGas) {
      totalPriorityFee += tx.maxPriorityFeePerGas;
      priorityFeeCount++;
    }
  }

  // Process logs
  const contractLogCounts = new Map<string, number>();

  for (const log of logs) {
    const addr = log.address.toLowerCase();
    contractLogCounts.set(addr, (contractLogCounts.get(addr) || 0) + 1);

    const topicCount = log.topics.filter(t => t !== null).length;
    const eventType = classifyLog(log.topics[0] ?? undefined, topicCount);
    addEvent(eventType);

    // Decode and store enriched data
    try {
      if (eventType === 'erc20_transfer') {
        const decoded = decodeErc20Transfer(log.topics, log.data);
        if (decoded) {
          tokenTransfers.push({
            txHash: log.txHash,
            logIndex: log.logIndex,
            tokenAddress: log.address,
            from: decoded.from,
            to: decoded.to,
            amount: decoded.amount.toString(),
          });
        }
      } else if (eventType === 'erc721_transfer') {
        const decoded = decodeErc721Transfer(log.topics);
        if (decoded) {
          nftTransfers.push({
            txHash: log.txHash,
            logIndex: log.logIndex,
            contractAddress: log.address,
            from: decoded.from,
            to: decoded.to,
            tokenId: decoded.tokenId.toString(),
            amount: '1',
            standard: 'ERC721',
          });
        }
      } else if (eventType === 'erc1155_transfer') {
        const decoded = decodeErc1155TransferSingle(log.topics, log.data);
        if (decoded) {
          nftTransfers.push({
            txHash: log.txHash,
            logIndex: log.logIndex,
            contractAddress: log.address,
            from: decoded.from,
            to: decoded.to,
            tokenId: decoded.tokenId.toString(),
            amount: decoded.amount.toString(),
            standard: 'ERC1155',
          });
        }
      } else if (eventType === 'dex_swap_v2' || eventType === 'dex_swap_aero') {
        // V2-style swaps (Uniswap V2, Aerodrome V2, SushiSwap, etc.)
        const decoded = decodeSwapV2(log.topics, log.data);
        if (decoded) {
          const dexName = getDexName(log.topics[0]!);
          
          dexSwaps.push({
            txHash: log.txHash,
            logIndex: log.logIndex,
            dexName,
            poolAddress: log.address,
            sender: decoded.sender,
            recipient: decoded.to,
            token0In: decoded.amount0In.toString(),
            token1In: decoded.amount1In.toString(),
            token0Out: decoded.amount0Out.toString(),
            token1Out: decoded.amount1Out.toString(),
          });
        }
      } else if (eventType === 'dex_swap_v3') {
        // V3-style swaps (Uniswap V3, Aerodrome Slipstream, PancakeSwap V3, etc.)
        const decoded = decodeSwapV3(log.topics, log.data);
        if (decoded) {
          const amount0In = decoded.amount0 > 0n ? decoded.amount0.toString() : '0';
          const amount1In = decoded.amount1 > 0n ? decoded.amount1.toString() : '0';
          const amount0Out = decoded.amount0 < 0n ? (-decoded.amount0).toString() : '0';
          const amount1Out = decoded.amount1 < 0n ? (-decoded.amount1).toString() : '0';
          
          const dexName = getDexName(log.topics[0]!);
          
          dexSwaps.push({
            txHash: log.txHash,
            logIndex: log.logIndex,
            dexName,
            poolAddress: log.address,
            sender: decoded.sender,
            recipient: decoded.recipient,
            token0In: amount0In,
            token1In: amount1In,
            token0Out: amount0Out,
            token1Out: amount1Out,
          });
        }
      }
    } catch (e) {
      // Decoding failed, skip this log
    }
  }

  // Top contracts by log count
  const topContracts = [...contractLogCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([address, count]) => ({ address, count }));

  const totalGas = txs.reduce((sum, tx) => sum + tx.gasUsed, 0n);

  return {
    metrics: {
      txCount: txs.length,
      logCount: logs.length,
      gasUsed: totalGas,
      avgGasPerTx: txs.length > 0 ? totalGas / BigInt(txs.length) : null,
      topContracts,
      eventCounts,
      uniqueFromAddresses: fromAddresses.size,
      uniqueToAddresses: toAddresses.size,
      avgGasPrice: txs.length > 0 ? totalGasPrice / BigInt(txs.length) : null,
      avgPriorityFee: priorityFeeCount > 0 ? totalPriorityFee / BigInt(priorityFeeCount) : null,
    },
    enriched: {
      tokenTransfers,
      nftTransfers,
      dexSwaps,
      contractDeployments,
    },
  };
}