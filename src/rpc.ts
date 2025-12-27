import { createPublicClient, http, type Chain } from 'viem';
import { base } from 'viem/chains';
import { cfg } from './config.js';

export const client = createPublicClient({
  chain: base as Chain,
  transport: http(cfg.RPC_URL, {
    retryCount: 5,
    retryDelay: 1000,
  }),
});
