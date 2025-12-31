/**
 * Pool Registry - Signature-based DEX classification
 * 
 * Categorizes swaps by their event signature:
 * - V2 swaps (Uniswap V2 style): Aerodrome V2, SushiSwap, BaseSwap, etc.
 * - V3 swaps (Uniswap V3 style): Uniswap V3, Aerodrome Slipstream, PancakeSwap V3
 * - Aerodrome/Solidly style: ve(3,3) DEXes with different signature
 * - Curve style: Curve pools
 */

// Event signatures (keccak256 of event definition)
const SIGNATURES = {
  // Uniswap V2 style: Swap(address,uint256,uint256,uint256,uint256,address)
  SWAP_V2: '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822',
  
  // Uniswap V3 style: Swap(address,address,int256,int256,uint160,uint128,int24)
  SWAP_V3: '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67',
  
  // Aerodrome/Solidly style: Swap(address,address,uint256,uint256,uint256,uint256)
  SWAP_AERO: '0xb3e2773606abfd36b5bd91394b3a54d1398336c65005baf7f44571de90422e19',
  
  // Curve TokenExchange: TokenExchange(address,int128,uint256,int128,uint256)
  SWAP_CURVE: '0x98de503528ee59b575ef0c0a2576a82497bfc029a5685b209e9ec333479b10a5',
  
  // Aerodrome Slipstream (CL): different from standard V3
  SWAP_CL: '0x70935338e69775456a85ddef226c395fb668b63fa0115f5f20610b388e6ca9c0',
};

/**
 * Get DEX name based on event signature
 * 
 * @param eventSignature - The topic[0] from the swap log
 * @returns DEX category name
 */
export function getDexName(eventSignature: string): string {
  if (!eventSignature) return 'Unknown';
  
  const sig = eventSignature.toLowerCase();
  
  // Uniswap V2 style (includes SushiSwap, BaseSwap, etc.)
  if (sig === SIGNATURES.SWAP_V2.toLowerCase()) {
    return 'Uniswap V2';
  }
  
  // Uniswap V3 style (includes PancakeSwap V3, etc.)
  if (sig === SIGNATURES.SWAP_V3.toLowerCase()) {
    return 'Uniswap V3';
  }
  
  // Aerodrome/Velodrome/Solidly style
  if (sig === SIGNATURES.SWAP_AERO.toLowerCase()) {
    return 'Aerodrome';
  }
  
  // Aerodrome Slipstream (concentrated liquidity)
  if (sig === SIGNATURES.SWAP_CL.toLowerCase()) {
    return 'Aerodrome CL';
  }
  
  // Curve
  if (sig === SIGNATURES.SWAP_CURVE.toLowerCase()) {
    return 'Curve';
  }
  
  return 'Unknown';
}

/**
 * Check if a signature is a known swap event
 */
export function isKnownSwapSignature(eventSignature: string): boolean {
  if (!eventSignature) return false;
  const sig = eventSignature.toLowerCase();
  
  return (
    sig === SIGNATURES.SWAP_V2.toLowerCase() ||
    sig === SIGNATURES.SWAP_V3.toLowerCase() ||
    sig === SIGNATURES.SWAP_AERO.toLowerCase() ||
    sig === SIGNATURES.SWAP_CL.toLowerCase() ||
    sig === SIGNATURES.SWAP_CURVE.toLowerCase()
  );
}

export { SIGNATURES as SWAP_SIGNATURES };