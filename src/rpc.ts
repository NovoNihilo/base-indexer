import { createPublicClient, http, type PublicClient } from 'viem';
import { base } from 'viem/chains';
import { cfg } from './config.js';

export const client: PublicClient = createPublicClient({
  chain: base,
  transport: http(cfg.RPC_URL, {
    retryCount: 5,
    retryDelay: ({ count }) => Math.min(1000 * 2 ** count, 30000),
  }),
});