import Database from 'better-sqlite3';
import { cfg } from '../config.js';
import { createTables } from './schema.js';

export const db = new Database(cfg.DB_PATH);
db.pragma('journal_mode = WAL');
createTables(db);

export const stmts = {
  // Core inserts
  insertBlock: db.prepare(`
    INSERT OR REPLACE INTO blocks (number, hash, parentHash, timestamp, gasUsed, gasLimit, baseFeePerGas, reorged)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `),
  insertTx: db.prepare(`
    INSERT OR IGNORE INTO transactions (hash, blockNumber, fromAddr, toAddr, value, input, gasPrice, maxFeePerGas, maxPriorityFeePerGas, gasUsed, effectiveGasPrice, txType)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  insertReceipt: db.prepare(`
    INSERT OR IGNORE INTO receipts (txHash, blockNumber, status, gasUsed, logCount, contractAddress, effectiveGasPrice)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  insertLog: db.prepare(`
    INSERT INTO logs (txHash, blockNumber, logIndex, address, topic0, topic1, topic2, topic3, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  insertBlockMetrics: db.prepare(`
    INSERT OR REPLACE INTO block_metrics (blockNumber, txCount, logCount, gasUsed, avgGasPerTx, topContracts, uniqueFromAddresses, uniqueToAddresses, avgGasPrice, avgPriorityFee)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  insertEventCount: db.prepare(`
    INSERT OR REPLACE INTO event_counts (blockNumber, eventType, count)
    VALUES (?, ?, ?)
  `),

  // New enriched data inserts
  insertTokenTransfer: db.prepare(`
    INSERT INTO token_transfers (txHash, blockNumber, logIndex, tokenAddress, fromAddr, toAddr, amount)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  insertNftTransfer: db.prepare(`
    INSERT INTO nft_transfers (txHash, blockNumber, logIndex, contractAddress, fromAddr, toAddr, tokenId, amount, standard)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  insertDexSwap: db.prepare(`
    INSERT INTO dex_swaps (txHash, blockNumber, logIndex, dexName, poolAddress, sender, recipient, token0In, token1In, token0Out, token1Out)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  insertContractDeployment: db.prepare(`
    INSERT INTO contract_deployments (txHash, blockNumber, deployer, contractAddress, gasUsed)
    VALUES (?, ?, ?, ?, ?)
  `),
  insertContractLabel: db.prepare(`
    INSERT OR REPLACE INTO contract_labels (address, name, category, protocol)
    VALUES (?, ?, ?, ?)
  `),
  insertDailyStats: db.prepare(`
    INSERT OR REPLACE INTO daily_stats (date, totalBlocks, totalTxs, totalLogs, totalGasUsed, uniqueFromAddresses, uniqueToAddresses, ethTransfers, contractCalls, contractCreations, tokenTransfers, nftTransfers, dexSwaps, avgGasPrice, avgBlockTime)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),

  // Lookups
  getCheckpoint: db.prepare(`SELECT lastBlock FROM checkpoint WHERE id = 1`),
  setCheckpoint: db.prepare(`INSERT OR REPLACE INTO checkpoint (id, lastBlock) VALUES (1, ?)`),
  getBlockByNumber: db.prepare(`SELECT hash, parentHash FROM blocks WHERE number = ? AND reorged = 0`),
  markReorged: db.prepare(`UPDATE blocks SET reorged = 1 WHERE number >= ?`),
  getContractLabel: db.prepare(`SELECT name, category, protocol FROM contract_labels WHERE address = ?`),
};

export function getLastProcessedBlock(): bigint | null {
  const row = stmts.getCheckpoint.get() as { lastBlock: number } | undefined;
  return row ? BigInt(row.lastBlock) : null;
}

export function setLastProcessedBlock(n: bigint) {
  stmts.setCheckpoint.run(Number(n));
}

// Seed known contract labels - comprehensive Base ecosystem
export function seedContractLabels() {
  const labels: [string, string, string, string][] = [
    // Major Stablecoins
    ['0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', 'USDC', 'token', 'Circle'],
    ['0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca', 'USDbC', 'token', 'Base'],
    ['0x50c5725949a6f0c72e6c4a641f24049a917db0cb', 'DAI', 'token', 'MakerDAO'],
    ['0x4a3a6dd60a34bb2aba60d73b4c88315e9ceb6a3d', 'USDT', 'token', 'Tether'],
    ['0x417ac0e078398c154edfadd9ef675d30be60af93', 'crvUSD', 'token', 'Curve'],
    ['0xb79dd08ea68a908a97220c76d19a6aa9cbde4376', 'USD+', 'token', 'Overnight'],
    ['0x65a2508c429a6078a7bc2f7df81ab575bd9d9275', 'DAI+', 'token', 'Overnight'],
    
    // Wrapped ETH variants
    ['0x4200000000000000000000000000000000000006', 'WETH', 'token', 'Base'],
    ['0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22', 'cbETH', 'token', 'Coinbase'],
    ['0xb6fe221fe9eef5aba221c348ba20a1bf5e73624c', 'rETH', 'token', 'RocketPool'],
    ['0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452', 'wstETH', 'token', 'Lido'],
    ['0x2416092f143378750bb29b79ed961ab195cceea5', 'ezETH', 'token', 'Renzo'],
    ['0x04c0599ae5a44757c0af6f9ec3b93da8976c150a', 'weETH', 'token', 'EtherFi'],
    ['0xecac9c5f704e954931349da37f60e39f515c11c1', 'eETH', 'token', 'EtherFi'],
    ['0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf', 'cbBTC', 'token', 'Coinbase'],
    ['0x0555e30da8f98308edb960aa94c0db47230d2b9c', 'LBTC', 'token', 'Lombard'],
    
    // Popular Base tokens
    ['0x532f27101965dd16442e59d40670faf5ebb142e4', 'BRETT', 'token', 'Brett'],
    ['0x4ed4e862860bed51a9570b96d89af5e1b0efefed', 'DEGEN', 'token', 'Degen'],
    ['0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b', 'HIGHER', 'token', 'Higher'],
    ['0x9a26f5433671751c3276a065f57e5a02d2817973', 'KEYCAT', 'token', 'Keyboard Cat'],
    ['0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4', 'TOSHI', 'token', 'Toshi'],
    ['0x6921b130d297cc43754afba22e5eac0fbf8db75b', 'doginme', 'token', 'doginme'],
    ['0x0578d8a44db98b23bf096a382e016e29a5ce0ffe', 'WELL', 'token', 'Moonwell'],
    ['0x22e6966b799c4d5b13be962e1d117b56327fda66', 'AERO', 'token', 'Aerodrome'],
    ['0x940181a94a35a4569e4529a3cdfb74e38fd98631', 'VIRTUAL', 'token', 'Virtual Protocol'],
    ['0xbc45647ea894030a4e9801ec03479739fa2485f0', 'BONSAI', 'token', 'Bonsai'],
    ['0xf5e2a99b19fe65c5355746765a42647984ca9aed', 'ANON', 'token', 'Anon'],
    ['0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825', 'AIXBT', 'token', 'aixbt'],
    ['0xba5e6fa2f33f3955f0cef50c63dcc84861eab663', 'LUNA', 'token', 'Luna'],
    ['0x768be13e1680b5ebe0024c42c896e3db59ec0149', 'SKI', 'token', 'Ski Mask Dog'],
    ['0x731814e491571a2a9456e76a6994e3c82cfb3ce4', 'GAME', 'token', 'Game'],
    ['0x1bc0c42215582d5a085795f3ee422018a4c9a0bc', 'VVV', 'token', 'Venice'],
    ['0x52b492a33e447cdb854c7fc19f1e57e8bfa1945d', 'PEPE', 'token', 'Pepe'],
    ['0x7d89e05c0b93b24b5cb23a073e60d008fed1acf9', 'NORMIE', 'token', 'Normie'],
    ['0x0d97f261b1e88845184f678e2d1e7a98d9fd38de', 'BASE', 'token', 'Base God'],
    ['0x3c8cd0db9a01efa063a7760267b822a129bc7dca', 'BENJI', 'token', 'Benji'],
    ['0x9ff8aa79df666632e00559018837f1e0e2f1f30b', 'CHOMP', 'token', 'Chomp'],
    ['0x8544fe9d190fd7ec52860abbf45088e81ee24a8c', 'SPEC', 'token', 'Spectral'],

    // Uniswap
    ['0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24', 'Uniswap V3 Router', 'dex', 'Uniswap'],
    ['0x2626664c2603336e57b271c5c0b26f421741e481', 'Uniswap V3 Router 2', 'dex', 'Uniswap'],
    ['0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad', 'Universal Router', 'dex', 'Uniswap'],
    ['0x33128a8fc17869897dce68ed026d694621f6fdfd', 'Uniswap V3 Factory', 'dex', 'Uniswap'],
    ['0x03a520b32c04bf3beef7beb72e919cf822ed34f1', 'Uniswap V3 Positions', 'dex', 'Uniswap'],
    ['0x1238536071e1c677a632429e3655c799b22cda52', 'Uniswap V4 Pool Manager', 'dex', 'Uniswap'],
    
    // Aerodrome
    ['0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43', 'Aerodrome Router', 'dex', 'Aerodrome'],
    ['0x6cb442acf35158d5eda88fe602221b67b400be3e', 'Aerodrome V2 Router', 'dex', 'Aerodrome'],
    ['0x420dd381b31aef6683db6b902084cb0ffece40da', 'Aerodrome Factory', 'dex', 'Aerodrome'],
    ['0x827922686190790b37229fd06084350e74485b72', 'Aerodrome Voter', 'dex', 'Aerodrome'],
    ['0xebf418fe2512e7e6bd9b87a8f0f294acdc67e6b4', 'Aerodrome veNFT', 'dex', 'Aerodrome'],
    ['0x16613524e02ad97edfef371bc883f2f5d6c480a5', 'Slipstream Factory', 'dex', 'Aerodrome'],
    
    // Base Bridge & System
    ['0x4200000000000000000000000000000000000010', 'L2 Standard Bridge', 'bridge', 'Base'],
    ['0x4200000000000000000000000000000000000007', 'L2 CrossDomain Messenger', 'bridge', 'Base'],
    ['0x4200000000000000000000000000000000000015', 'L1 Block', 'system', 'Base'],
    ['0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001', 'L1 Block Attributes', 'system', 'Base'],
    ['0x420000000000000000000000000000000000000f', 'Gas Price Oracle', 'system', 'Base'],
    ['0x4200000000000000000000000000000000000011', 'Sequencer Fee Vault', 'system', 'Base'],
    ['0x4200000000000000000000000000000000000016', 'L2 ERC721 Bridge', 'bridge', 'Base'],
    ['0x4200000000000000000000000000000000000012', 'L1 Base Fee Vault', 'system', 'Base'],
    ['0x4200000000000000000000000000000000000019', 'Base Fee Vault', 'system', 'Base'],
    
    // Lending Protocols
    ['0xa238dd80c259a72e81d7e4664a9801593f98d1c5', 'Aave V3 Pool', 'lending', 'Aave'],
    ['0xe20fcbdbffc4dd138ce8b2e6fbb6cb49777ad64d', 'Aave V3 aWETH', 'lending', 'Aave'],
    ['0x4e65fe4dba92790696d040ac24aa414708f5c0ab', 'Aave V3 aUSDbC', 'lending', 'Aave'],
    ['0xd4a0e0b9149bcee3c920d2e00b5de09138fd8bb7', 'Aave V3 Rewards', 'lending', 'Aave'],
    ['0xa96637587ef3d9aec07ae317b03c85f7dd9d0568', 'Moonwell Comptroller', 'lending', 'Moonwell'],
    ['0x628ff693426583d9a7fb391e54366292f509d457', 'Moonwell mWETH', 'lending', 'Moonwell'],
    ['0xed8edb6dbadf1b597e12432a8d861dd3d2103f25', 'Moonwell mUSDbC', 'lending', 'Moonwell'],
    ['0xedc817a28e8b93b03976fbd4a3ddbc9f7d176c22', 'Moonwell mUSdc', 'lending', 'Moonwell'],
    ['0x04c0599ae5a44757c0af6f9ec3b93da8976c150a', 'Morpho weETH Vault', 'lending', 'Morpho'],
    ['0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb', 'Morpho Blue', 'lending', 'Morpho'],
    ['0xba8828d1a1f4e0b3831fa9b11c395f1db05bb76c', 'Seamless Pool', 'lending', 'Seamless'],
    ['0x2c8f64c0ff70e6e5a5cce2e3aa25d3e4f96a981e', 'Compound v3 WETH', 'lending', 'Compound'],
    ['0xb125e6687d4313864e53df431d5425969c15eb2f', 'Compound v3 USDC', 'lending', 'Compound'],
    
    // Account Abstraction / Smart Wallets
    ['0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789', 'EntryPoint v0.6', 'aa', 'ERC-4337'],
    ['0x0000000071727de22e5e9d8baf0edac6f37da032', 'EntryPoint v0.7', 'aa', 'ERC-4337'],
    ['0x000000a56aaca3e9a4c479ea6b6cd0dbcb6634f5', 'Socket Gateway', 'bridge', 'Socket'],
    ['0x95401dc811bb5740090279ba06cfa8fcf6113778', 'Safe Proxy Factory', 'wallet', 'Safe'],
    ['0xd9db270c1b5e3bd161e8c8503c55ceabee709552', 'Safe Singleton', 'wallet', 'Safe'],
    ['0x29fcb43b46531bca003ddc8fcb67ffe91900c762', 'Safe 1.4.1', 'wallet', 'Safe'],
    ['0xcfe35feeae32b2cc4f6c9d100e5571f50e8a61ba', 'Coinbase Smart Wallet Factory', 'wallet', 'Coinbase'],
    ['0x0ba5ed0c6aa8c49038f819e587e2633c4a9f428a', 'Coinbase Smart Wallet', 'wallet', 'Coinbase'],
    
    // NFT & Gaming
    ['0x2a1dac7df15f6aa7c0f952c7e0f60fbc30a7e2d1', 'Base Onchain Summer', 'nft', 'Base'],
    ['0x1fc10ef15e041c5d3c54042e52eb0c54cb9b710c', 'Base Day One', 'nft', 'Base'],
    ['0x7d5861cfe1c74aaa0999b7e2651bf2ebd2a62d89', 'Mint.fun', 'nft', 'Mint.fun'],
    ['0x00000000001594c61dd8a6804da9ab58ed2483ce', 'Zora 1155', 'nft', 'Zora'],
    ['0x777777722d078c97c6ad07d9f36801e653e356ae', 'Zora Rewards', 'nft', 'Zora'],
    ['0x04e2516a2c207e84a1839755675dfd8ef6302f0a', 'Zora Factory', 'nft', 'Zora'],
    
    // Oracles
    ['0x71041dddad3595f9ced3dccfbe3d1f4b0a16bb70', 'Pyth Oracle', 'oracle', 'Pyth'],
    ['0x8250f4af4b972684f7b336503e2d6dfedeb1487a', 'RedStone Oracle', 'oracle', 'RedStone'],
    ['0x71041dddad3595f9ced3dccfbe3d1f4b0a16bb70', 'Chainlink Price Feed', 'oracle', 'Chainlink'],
    
    // Cross-chain
    ['0x3a23f943181408eac424116af7b7790c94cb97a5', 'Socket Vault', 'bridge', 'Socket'],
    ['0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae', 'Li.Fi Diamond', 'bridge', 'Li.Fi'],
    ['0x0000000000001ff3684f28c67538d4d072c22734', 'Stargate Router', 'bridge', 'Stargate'],
    ['0xaf5191b0de278c7286d6c7cc6ab6bb8a73ba2cd6', 'Stargate Token', 'bridge', 'Stargate'],
    ['0x19330d10d9cc8751218eaf51e8885d058642e08a', 'Across Bridge', 'bridge', 'Across'],
    ['0x09aea4b2242abc8bb4bb78d537a67a245a7bec64', 'Axelar Gateway', 'bridge', 'Axelar'],
    ['0x4200000000000000000000000000000000000014', 'L2 Output Oracle', 'bridge', 'Base'],
    
    // Other DEXs & AMMs
    ['0xd5e8d7f221f44e49b4d01e6b46b33abf23c56e7a', 'Curve StableSwap', 'dex', 'Curve'],
    ['0x11c1fbd4b3de66bc0565779b35171a6e3c1a2895', 'Balancer Vault', 'dex', 'Balancer'],
    ['0x1b0d217a87cb7e66c88c34b53fe7a5d0b59f8c59', 'PancakeSwap Router', 'dex', 'PancakeSwap'],
    ['0x8cbd6fadcf60536e0f04494f65802bb2e24875a9', 'Maverick Pool', 'dex', 'Maverick'],
    ['0x32aea31cf5bcf5e12b8b00bd3fd68d5a7ae0ba8e', 'SushiSwap Router', 'dex', 'SushiSwap'],
    ['0x6bded42c6da8fbf0d2ba55b2fa120c5e0c8d7891', 'BaseSwap Router', 'dex', 'BaseSwap'],
    ['0x327df1e6de05895d2ab08513aadd9313fe505d86', 'BaseSwap Factory', 'dex', 'BaseSwap'],
    ['0x0000000000000068f116a894984e2db1123eb395', 'Odos Router', 'aggregator', 'Odos'],
    ['0x6131b5fae19ea4f9d964eac0408e4408b66337b5', 'Kyber Aggregator', 'aggregator', 'KyberSwap'],
    ['0x111111125421ca6dc452d289314280a0f8842a65', '1inch Router', 'aggregator', '1inch'],
    ['0x1111111254eeb25477b68fb85ed929f73a960582', '1inch v5', 'aggregator', '1inch'],
    ['0x6352a56caadc4f1e25cd6c75970fa768a3304e64', 'OpenOcean', 'aggregator', 'OpenOcean'],
    
    // Perps / Derivatives
    ['0xc35dadb65012ec5796536bd9864ed8773abc74c4', 'GMX Factory', 'perps', 'GMX'],
    ['0x9c12939390052919af3155f41bf4160fd3666a6f', 'Perpetual Protocol', 'perps', 'Perpetual'],
    ['0x50c5725949a6f0c72e6c4a641f24049a917db0cb', 'Synthetix Core', 'perps', 'Synthetix'],
    
    // Misc Popular
    ['0xd1d2eb1b1e90b638588728b4130137d262c87cae', 'Gelato Automate', 'automation', 'Gelato'],
    ['0x7b5cb8a9c8f49f55d9f0a8c93d8f5adddcae2d20', 'Guild.xyz', 'social', 'Guild'],
    ['0xecf053389f5f55e1b9dc1ce2c093c4aa53e2e5c5', 'Paragraph', 'social', 'Paragraph'],
    ['0xef4fb24ad0916217251f553c0596f8edc630eb66', 'Warpcast Registry', 'social', 'Farcaster'],
    ['0x00000000fcce7f938e7ae6d3c335bd6a1a7c593d', 'Farcaster ID Registry', 'social', 'Farcaster'],
    ['0x00000000fc6c5f01fc30151999387bb99a9f489b', 'Farcaster Key Registry', 'social', 'Farcaster'],
    ['0x00000000fc04c910a0b5fea33b03e0447ad0b0aa', 'Farcaster Bundler', 'social', 'Farcaster'],
    ['0xc67a86a6c2e3e5026e55c1d9a7c1e2195c3ef1b8', 'friend.tech', 'social', 'friend.tech'],
    ['0xbeea45f16d512a01f7e2a3785458d4a7089c8514', 'Clique Points', 'social', 'Clique'],
  ];

  for (const [address, name, category, protocol] of labels) {
    stmts.insertContractLabel.run(address.toLowerCase(), name, category, protocol);
  }
}

// Run on startup
seedContractLabels();