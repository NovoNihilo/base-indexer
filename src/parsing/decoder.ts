/**
 * Decoder functions for blockchain events
 * Re-exports getDexName from pool-registry for convenience
 */

// Re-export getDexName from pool-registry
export { getDexName } from './pool-registry.js';

/**
 * Decode ERC20 Transfer event
 * Transfer(address indexed from, address indexed to, uint256 value)
 */
export function decodeErc20Transfer(
  topics: (string | null)[],
  data: string
): { from: string; to: string; amount: bigint } | null {
  if (topics.length < 3 || !topics[1] || !topics[2]) return null;
  
  const from = '0x' + topics[1].slice(26);
  const to = '0x' + topics[2].slice(26);
  const amount = BigInt(data || '0x0');
  
  return { from, to, amount };
}

/**
 * Decode ERC721 Transfer event
 * Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
 */
export function decodeErc721Transfer(
  topics: (string | null)[]
): { from: string; to: string; tokenId: bigint } | null {
  if (topics.length < 4 || !topics[1] || !topics[2] || !topics[3]) return null;
  
  const from = '0x' + topics[1].slice(26);
  const to = '0x' + topics[2].slice(26);
  const tokenId = BigInt(topics[3]);
  
  return { from, to, tokenId };
}

/**
 * Decode ERC1155 TransferSingle event
 * TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)
 */
export function decodeErc1155TransferSingle(
  topics: (string | null)[],
  data: string
): { operator: string; from: string; to: string; tokenId: bigint; amount: bigint } | null {
  if (topics.length < 4 || !topics[1] || !topics[2] || !topics[3]) return null;
  if (data.length < 130) return null; // 0x + 64 + 64
  
  const operator = '0x' + topics[1].slice(26);
  const from = '0x' + topics[2].slice(26);
  const to = '0x' + topics[3].slice(26);
  const tokenId = BigInt('0x' + data.slice(2, 66));
  const amount = BigInt('0x' + data.slice(66, 130));
  
  return { operator, from, to, tokenId, amount };
}

/**
 * Decode V2-style Swap event (Uniswap V2, Aerodrome V2, SushiSwap, etc.)
 * Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)
 */
export function decodeSwapV2(
  topics: (string | null)[],
  data: string
): {
  sender: string;
  amount0In: bigint;
  amount1In: bigint;
  amount0Out: bigint;
  amount1Out: bigint;
  to: string;
} | null {
  if (topics.length < 3 || !topics[1] || !topics[2]) return null;
  if (data.length < 258) return null; // 0x + 4 * 64
  
  const sender = '0x' + topics[1].slice(26);
  const to = '0x' + topics[2].slice(26);
  
  const amount0In = BigInt('0x' + data.slice(2, 66));
  const amount1In = BigInt('0x' + data.slice(66, 130));
  const amount0Out = BigInt('0x' + data.slice(130, 194));
  const amount1Out = BigInt('0x' + data.slice(194, 258));
  
  return { sender, amount0In, amount1In, amount0Out, amount1Out, to };
}

/**
 * Decode V3-style Swap event (Uniswap V3, Aerodrome Slipstream, etc.)
 * Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)
 */
export function decodeSwapV3(
  topics: (string | null)[],
  data: string
): {
  sender: string;
  recipient: string;
  amount0: bigint;
  amount1: bigint;
  sqrtPriceX96: bigint;
  liquidity: bigint;
  tick: number;
} | null {
  if (topics.length < 3 || !topics[1] || !topics[2]) return null;
  if (data.length < 322) return null; // 0x + 5 * 64
  
  const sender = '0x' + topics[1].slice(26);
  const recipient = '0x' + topics[2].slice(26);
  
  // int256 values - need to handle negative numbers
  const amount0Raw = BigInt('0x' + data.slice(2, 66));
  const amount1Raw = BigInt('0x' + data.slice(66, 130));
  
  // Convert from uint256 to int256
  const MAX_INT256 = BigInt('0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
  const amount0 = amount0Raw > MAX_INT256 ? amount0Raw - BigInt('0x10000000000000000000000000000000000000000000000000000000000000000') : amount0Raw;
  const amount1 = amount1Raw > MAX_INT256 ? amount1Raw - BigInt('0x10000000000000000000000000000000000000000000000000000000000000000') : amount1Raw;
  
  const sqrtPriceX96 = BigInt('0x' + data.slice(130, 194));
  const liquidity = BigInt('0x' + data.slice(194, 258));
  
  // int24 tick
  const tickRaw = BigInt('0x' + data.slice(258, 322));
  const tick = Number(tickRaw > BigInt(0x7fffff) ? tickRaw - BigInt(0x1000000) : tickRaw);
  
  return { sender, recipient, amount0, amount1, sqrtPriceX96, liquidity, tick };
}