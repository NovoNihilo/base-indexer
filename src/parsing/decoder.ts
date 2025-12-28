import { decodeAbiParameters, type Hex } from 'viem';
import { SIGNATURES } from './classifier.js';
import { getDexForPoolSync, queuePoolLookup } from './pool-registry.js';

export interface DecodedTransfer {
  from: string;
  to: string;
  amount: bigint;
}

export interface DecodedNftTransfer {
  from: string;
  to: string;
  tokenId: bigint;
  amount: bigint;
  standard: 'ERC721' | 'ERC1155';
}

export interface DecodedSwapV2 {
  sender: string;
  amount0In: bigint;
  amount1In: bigint;
  amount0Out: bigint;
  amount1Out: bigint;
  to: string;
}

export interface DecodedSwapV3 {
  sender: string;
  recipient: string;
  amount0: bigint;
  amount1: bigint;
  sqrtPriceX96: bigint;
  liquidity: bigint;
  tick: number;
}

// Decode ERC-20 Transfer
export function decodeErc20Transfer(topics: (string | null)[], data: string): DecodedTransfer | null {
  try {
    if (!topics[1] || !topics[2]) return null;
    
    // from and to are in topics (indexed)
    const from = '0x' + topics[1].slice(26);
    const to = '0x' + topics[2].slice(26);
    
    // amount is in data
    const [amount] = decodeAbiParameters(
      [{ type: 'uint256' }],
      data as Hex
    );
    
    return { from, to, amount };
  } catch {
    return null;
  }
}

// Decode ERC-721 Transfer
export function decodeErc721Transfer(topics: (string | null)[]): DecodedNftTransfer | null {
  try {
    if (!topics[1] || !topics[2] || !topics[3]) return null;
    
    const from = '0x' + topics[1].slice(26);
    const to = '0x' + topics[2].slice(26);
    const tokenId = BigInt(topics[3]);
    
    return { from, to, tokenId, amount: 1n, standard: 'ERC721' };
  } catch {
    return null;
  }
}

// Decode ERC-1155 TransferSingle
export function decodeErc1155TransferSingle(topics: (string | null)[], data: string): DecodedNftTransfer | null {
  try {
    if (!topics[2] || !topics[3]) return null;
    
    const from = '0x' + topics[2].slice(26);
    const to = '0x' + topics[3].slice(26);
    
    const [tokenId, amount] = decodeAbiParameters(
      [{ type: 'uint256' }, { type: 'uint256' }],
      data as Hex
    );
    
    return { from, to, tokenId, amount, standard: 'ERC1155' };
  } catch {
    return null;
  }
}

// Decode Uniswap V2 / Aerodrome V2 / Hydrex Swap
export function decodeSwapV2(topics: (string | null)[], data: string): DecodedSwapV2 | null {
  try {
    if (!topics[1] || !topics[2]) return null;
    
    const sender = '0x' + topics[1].slice(26);
    const to = '0x' + topics[2].slice(26);
    
    const [amount0In, amount1In, amount0Out, amount1Out] = decodeAbiParameters(
      [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
      data as Hex
    );
    
    return { sender, amount0In, amount1In, amount0Out, amount1Out, to };
  } catch {
    return null;
  }
}

// Decode Uniswap V3 / PancakeSwap V3 / Aerodrome CL Swap
export function decodeSwapV3(topics: (string | null)[], data: string): DecodedSwapV3 | null {
  try {
    if (!topics[1] || !topics[2]) return null;
    
    const sender = '0x' + topics[1].slice(26);
    const recipient = '0x' + topics[2].slice(26);
    
    const [amount0, amount1, sqrtPriceX96, liquidity, tick] = decodeAbiParameters(
      [{ type: 'int256' }, { type: 'int256' }, { type: 'uint160' }, { type: 'uint128' }, { type: 'int24' }],
      data as Hex
    );
    
    return { 
      sender, 
      recipient, 
      amount0: amount0 as bigint, 
      amount1: amount1 as bigint, 
      sqrtPriceX96: sqrtPriceX96 as bigint, 
      liquidity: liquidity as bigint, 
      tick: Number(tick) 
    };
  } catch {
    return null;
  }
}

/**
 * Get DEX name for a swap event.
 * 
 * Uses pool registry for accurate identification:
 * - Checks cache first (sync, fast)
 * - Queues async factory lookup if not cached
 * - Falls back to signature-based detection only for edge cases
 * 
 * @param poolAddress - The pool contract that emitted the swap
 * @param topic0 - The event signature
 * @returns DEX name
 */
export function getDexName(poolAddress: string, topic0: string): string {
  // Try sync cache lookup first (covers 99%+ of cases after warmup)
  const cached = getDexForPoolSync(poolAddress);
  if (cached) {
    return cached;
  }
  
  // Queue async lookup for next time
  queuePoolLookup(poolAddress, topic0);
  
  // For now, use signature-based fallback
  // This will only happen on first encounter of a new pool
  return getSignatureBasedDexName(topic0);
}

/**
 * Legacy signature-based DEX detection.
 * 
 * IMPORTANT: This is inaccurate for many DEXes that share signatures!
 * - V3 signature is shared by: Uniswap V3, PancakeSwap V3, SushiSwap V3
 * - V2 signature is shared by: Uniswap V2, many forks
 * - Aero signature is shared by: Aerodrome, Velodrome, Hydrex
 * 
 * Only used as fallback when pool isn't in cache yet.
 */
function getSignatureBasedDexName(topic0: string): string {
  const sig = topic0.toLowerCase();
  
  // Curve has unique signature
  if (sig === '0x98de503528ee59b575ef0c0a2576a82497bfc029a5685b209e9ec333479b10a5') {
    return 'Curve';
  }
  
  // V3-style (could be Uniswap V3, PancakeSwap V3, etc)
  if (sig === SIGNATURES.SWAP_V3.toLowerCase()) {
    return 'DEX V3'; // Generic until factory lookup completes
  }
  
  // V2-style (could be Uniswap V2, BaseSwap, etc)
  if (sig === SIGNATURES.SWAP_V2.toLowerCase()) {
    return 'DEX V2'; // Generic until factory lookup completes
  }
  
  // Aerodrome-style (could be Aerodrome, Hydrex, Velodrome fork)
  if (sig === SIGNATURES.SWAP_AERO.toLowerCase()) {
    return 'DEX ve(3,3)'; // Generic until factory lookup completes
  }
  
  // Aerodrome CL / Slipstream
  if (sig === '0x70935338e69775456a85ddef226c395fb668b63fa0115f5f20610b388e6ca9c0') {
    return 'DEX CL'; // Generic until factory lookup completes
  }
  
  return 'Unknown DEX';
}

/**
 * Check if the pool registry has been warmed up for this pool.
 * Useful for knowing if getDexName result is accurate or a fallback.
 */
export function isPoolCached(poolAddress: string): boolean {
  return getDexForPoolSync(poolAddress) !== null;
}