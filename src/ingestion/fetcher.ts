import pLimit from 'p-limit';
import { client } from '../rpc.js';
import { cfg } from '../config.js';

const limit = pLimit(cfg.CONCURRENCY_LIMIT);

export async function fetchBlockWithTxs(blockNumber: bigint) {
  return client.getBlock({ blockNumber, includeTransactions: true });
}

export async function fetchReceipts(txHashes: string[]) {
  const tasks = txHashes.map((hash) =>
    limit(() => client.getTransactionReceipt({ hash: hash as `0x${string}` }))
  );
  return Promise.all(tasks);
}

export async function getLatestBlockNumber(): Promise<bigint> {
  return client.getBlockNumber();
}
