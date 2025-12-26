import { config } from 'dotenv';
import { z } from 'zod';

config();

const schema = z.object({
  RPC_URL: z.string().url(),
  POLL_INTERVAL_MS: z.coerce.number().default(2000),
  SAFETY_BUFFER_BLOCKS: z.coerce.number().default(3),
  REORG_REWIND_DEPTH: z.coerce.number().default(10),
  STATS_WINDOW_BLOCKS: z.coerce.number().default(100),
  CONCURRENCY_LIMIT: z.coerce.number().default(5),
  DB_PATH: z.string().default('./data/base.db'),
});

export const cfg = schema.parse(process.env);
