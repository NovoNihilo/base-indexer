import type { Log } from 'viem';
import { classifyTx, classifyLog, type EventType } from './classifier.js';

interface TxData {
  hash: string;
  to: string | null;
  value: bigint;
  input: string;
  gasUsed: bigint;
}

export interface BlockMetrics {
  txCount: number;
  logCount: number;
  gasUsed: bigint;
  avgGasPerTx: bigint | null;
  topContracts: { address: string; count: number }[];
  eventCounts: Record<EventType, number>;
}

export function computeBlockMetrics(
  txs: TxData[],
  logs: Log[]
): BlockMetrics {
  const eventCounts: Record<EventType, number> = {
    eth_transfer: 0,
    contract_creation: 0,
    transfer_event: 0,
    contract_call: 0,
  };

  for (const tx of txs) {
    const type = classifyTx(tx);
    eventCounts[type]++;
  }

  const contractLogCounts = new Map<string, number>();
  for (const log of logs) {
    const addr = log.address.toLowerCase();
    contractLogCounts.set(addr, (contractLogCounts.get(addr) || 0) + 1);

    const logType = classifyLog(log.topics[0]);
    if (logType) eventCounts[logType]++;
  }

  const topContracts = [...contractLogCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([address, count]) => ({ address, count }));

  const totalGas = txs.reduce((sum, tx) => sum + tx.gasUsed, 0n);

  return {
    txCount: txs.length,
    logCount: logs.length,
    gasUsed: totalGas,
    avgGasPerTx: txs.length > 0 ? totalGas / BigInt(txs.length) : null,
    topContracts,
    eventCounts,
  };
}
