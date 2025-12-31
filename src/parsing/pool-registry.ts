/**
 * SIMPLE Pool Registry - No RPC calls, no database
 * 
 * Categorizes swaps by event signature type:
 * - V2 swaps → "V2 AMM" (Aerodrome V2, SushiSwap, etc.)
 * - V3 swaps → "V3 CL" (Aerodrome Slipstream, Uniswap V3, etc.)
 * 
 * This is the simplest possible implementation that actually works.
 */

// Event signatures
const V2_SWAP_SIGNATURE = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822';
const V3_SWAP_SIGNATURE = '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67';

/**
 * Get DEX name based on event signature
 * @param poolAddress - Not used in simple version, kept for API compatibility
 * @param eventSignature - The topic[0] from the log
 */
export function getDexName(poolAddress: string, eventSignature: string): string {
  const sig = eventSignature.toLowerCase();
  
  if (sig === V2_SWAP_SIGNATURE.toLowerCase()) {
    return 'V2 AMM';
  }
  
  if (sig === V3_SWAP_SIGNATURE.toLowerCase()) {
    return 'V3 CL';
  }
  
  return 'Unknown';
}

/**
 * No-op function for API compatibility
 * The old version had async pool lookups - this version doesn't need them
 */
export async function flushPendingLookups(): Promise<void> {
  // No-op - nothing to flush in the simple version
}

/**
 * Initialize function for API compatibility
 * @param db - Not used in simple version
 */
export function initPoolRegistry(db: unknown): void {
  // No-op - nothing to initialize in the simple version
  console.log('📊 Pool registry initialized (simple mode - signature-based classification)');
}

/**
 * Load cache function for API compatibility  
 */
export function loadPoolDexCache(): void {
  // No-op - no cache needed
}