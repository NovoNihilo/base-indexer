import { startPoller } from '../ingestion/poller.js';

console.log('🔗 Base Indexer - Forward-Only Ingestion');
startPoller().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
