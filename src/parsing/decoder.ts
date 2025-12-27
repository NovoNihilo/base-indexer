import { decodeAbiParameters, type Hex } from 'viem';
import { SIGNATURES } from './classifier.js';

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

// Decode Uniswap V2 / Aerodrome Swap
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

// Decode Uniswap V3 Swap
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

// Determine DEX name from swap event signature
export function getDexName(topic0: string): string {
  const sig = topic0.toLowerCase();
  if (sig === SIGNATURES.SWAP_V3.toLowerCase()) return 'Uniswap V3';
  if (sig === SIGNATURES.SWAP_V2.toLowerCase()) return 'Uniswap V2';
  if (sig === SIGNATURES.SWAP_AERO.toLowerCase()) return 'Aerodrome';
  return 'Unknown DEX';
}
