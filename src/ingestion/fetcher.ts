import pLimit from 'p-limit';
import { client } from '../rpc.js';
import { cfg } from '../config.js';

const limit = pLimit(cfg.CONCURRENCY_LIMIT);

export async function fetchBlockWithTxs(blockNumber: bigint) {
  return client.getBlock({ blockNumber, includeTransactions: true });
}

export async function fetchBlockReceipts(blockNumber: bigint): Promise<any[] | null> {
  try {
    const receipts = await client.request({
      method: 'eth_getBlockReceipts' as any,
      params: [`0x${blockNumber.toString(16)}`],
    });
    return receipts as any[];
  } catch {
    return null;
  }
}

export async function fetchReceiptsIndividually(txHashes: string[]) {
  const tasks = txHashes.map((hash) =>
    limit(() => client.getTransactionReceipt({ hash: hash as `0x${string}` }))
  );
  return Promise.all(tasks);
}

export async function getLatestBlockNumber(): Promise<bigint> {
  return client.getBlockNumber();
}
