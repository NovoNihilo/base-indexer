/**
 * Pool Registry - Maps pool addresses to their parent DEX
 * 
 * Strategy: When we encounter a Swap event from an unknown pool,
 * we query the pool's factory() function to determine which DEX it belongs to.
 * Results are cached in SQLite for fast lookups.
 */

import { db } from '../storage/db.js';
import { client } from '../rpc.js';
import type { Hex, Address } from 'viem';

// ============================================================================
// DEX FACTORY ADDRESSES (lowercase)
// ============================================================================

const FACTORY_TO_DEX: Record<string, string> = {
  // Uniswap
  '0x33128a8fc17869897dce68ed026d694621f6fdfd': 'Uniswap V3',
  '0x8909dc15e40173ff4699343b6eb8132c65e18ec6': 'Uniswap V2',
  
  // Aerodrome
  '0x420dd381b31aef6683db6b902084cb0ffece40da': 'Aerodrome V2',
  '0x5e7bb104d84c7cb9b682aac2c5444c427988a6a6': 'Aerodrome CL',
  
  // PancakeSwap
  '0x0bfbcf9fa4f9c56b0f40a671ad40e0805a091865': 'PancakeSwap V3',
  '0x02a84c1b3bbd7401a5f7fa98a384ebc70bb5749e': 'PancakeSwap V2',
  
  // Hydrex (ve3,3 fork)
  '0x36077d39cdc65e1e3fb65810430e5b2c4d5fa29e': 'Hydrex',
  
  // BaseSwap
  '0x327df1e6de05895d2ab08513aadd9313fe505d86': 'BaseSwap',
  
  // SushiSwap
  '0x71524b4f93c58fcbf659783284e38825f0622859': 'SushiSwap V3',
  
  // Maverick
  '0xb2855783a346735e4aae0c1eb894def861fa9b45': 'Maverick',
  
  // Balancer
  '0xba12222222228d8ba445958a75a0704d566bf2c8': 'Balancer',
};

// ============================================================================
// SPECIAL SINGLETON CONTRACTS (not factory-based)
// ============================================================================

// Uniswap V4 uses a singleton PoolManager - all V4 swaps emit from this address
const UNISWAP_V4_POOL_MANAGER = '0x498581ff718922c3f8e6a244956af099b2652b2b';

// Curve pools don't have a factory() function, identify by known pools or registry
const CURVE_POOLS = new Set([
  '0x7f90122bf0700f9e7e1f688fe926940e8839f353', // Curve 3pool
  '0x6e53131f68a034873b6bfa15502af094ef0c5854', // Curve crvUSD/USDC
  // Add more as discovered
]);

// ============================================================================
// IN-MEMORY CACHE (populated from SQLite on startup)
// ============================================================================

const poolCache = new Map<string, string>();
let cacheLoaded = false;

// Prepared statements (initialized lazily)
let getPoolDexStmt: any;
let insertPoolDexStmt: any;

function initStatements() {
  if (!getPoolDexStmt) {
    getPoolDexStmt = db.prepare(`SELECT dexName FROM pool_dex_cache WHERE poolAddress = ?`);
    insertPoolDexStmt = db.prepare(`INSERT OR REPLACE INTO pool_dex_cache (poolAddress, factoryAddress, dexName) VALUES (?, ?, ?)`);
  }
}

function loadCache() {
  if (cacheLoaded) return;
  
  try {
    const rows = db.prepare(`SELECT poolAddress, dexName FROM pool_dex_cache`).all() as { poolAddress: string; dexName: string }[];
    for (const row of rows) {
      poolCache.set(row.poolAddress.toLowerCase(), row.dexName);
    }
    cacheLoaded = true;
    console.log(`📦 Loaded ${poolCache.size} pools into DEX cache`);
  } catch (e) {
    // Table might not exist yet
    cacheLoaded = true;
  }
}

// ============================================================================
// FACTORY QUERY
// ============================================================================

const FACTORY_ABI = [
  {
    inputs: [],
    name: 'factory',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

async function queryPoolFactory(poolAddress: string): Promise<string | null> {
  try {
    const factory = await client.readContract({
      address: poolAddress as Address,
      abi: FACTORY_ABI,
      functionName: 'factory',
    });
    return (factory as string).toLowerCase();
  } catch {
    return null;
  }
}

// ============================================================================
// MAIN API
// ============================================================================

/**
 * Get the DEX name for a pool address.
 * 
 * Resolution order:
 * 1. Check if it's a known singleton (Uniswap V4 PoolManager)
 * 2. Check if it's a known Curve pool
 * 3. Check in-memory cache
 * 4. Check SQLite cache
 * 5. Query the pool's factory() on-chain and cache result
 * 
 * @param poolAddress - The pool contract address
 * @param topic0 - The event signature (used for fallback classification)
 * @returns DEX name or 'Unknown DEX' if not identifiable
 */
export async function getDexForPool(poolAddress: string, topic0?: string): Promise<string> {
  const addr = poolAddress.toLowerCase();
  
  // 1. Singleton contracts
  if (addr === UNISWAP_V4_POOL_MANAGER) {
    return 'Uniswap V4';
  }
  
  // 2. Known Curve pools
  if (CURVE_POOLS.has(addr)) {
    return 'Curve';
  }
  
  // 3. In-memory cache
  loadCache();
  const cached = poolCache.get(addr);
  if (cached) {
    return cached;
  }
  
  // 4. SQLite cache
  initStatements();
  const row = getPoolDexStmt.get(addr) as { dexName: string } | undefined;
  if (row) {
    poolCache.set(addr, row.dexName);
    return row.dexName;
  }
  
  // 5. Query factory on-chain
  const factoryAddr = await queryPoolFactory(addr);
  
  if (factoryAddr) {
    const dexName = FACTORY_TO_DEX[factoryAddr];
    if (dexName) {
      // Cache the result
      poolCache.set(addr, dexName);
      insertPoolDexStmt.run(addr, factoryAddr, dexName);
      return dexName;
    }
    
    // Unknown factory - cache as "Unknown" with factory for later analysis
    const unknownName = `Unknown (${factoryAddr.slice(0, 10)}...)`;
    poolCache.set(addr, unknownName);
    insertPoolDexStmt.run(addr, factoryAddr, unknownName);
    return unknownName;
  }
  
  // No factory function - might be Curve or other non-standard pool
  // Fall back to signature-based detection for these edge cases
  if (topic0) {
    const fallbackName = getFallbackDexName(topic0);
    if (fallbackName !== 'Unknown DEX') {
      poolCache.set(addr, fallbackName);
      insertPoolDexStmt.run(addr, '', fallbackName);
      return fallbackName;
    }
  }
  
  return 'Unknown DEX';
}

/**
 * Synchronous version for use in hot paths where we can't await.
 * Only returns cached results, returns null if not cached.
 */
export function getDexForPoolSync(poolAddress: string): string | null {
  const addr = poolAddress.toLowerCase();
  
  // Singleton contracts
  if (addr === UNISWAP_V4_POOL_MANAGER) {
    return 'Uniswap V4';
  }
  
  // Known Curve pools
  if (CURVE_POOLS.has(addr)) {
    return 'Curve';
  }
  
  // In-memory cache
  loadCache();
  const cached = poolCache.get(addr);
  if (cached) {
    return cached;
  }
  
  // SQLite cache
  initStatements();
  try {
    const row = getPoolDexStmt.get(addr) as { dexName: string } | undefined;
    if (row) {
      poolCache.set(addr, row.dexName);
      return row.dexName;
    }
  } catch {
    // Table might not exist
  }
  
  return null;
}

/**
 * Queue a pool for async factory lookup.
 * Call this when getDexForPoolSync returns null.
 */
const pendingLookups = new Map<string, Promise<string>>();

export function queuePoolLookup(poolAddress: string, topic0?: string): Promise<string> {
  const addr = poolAddress.toLowerCase();
  
  // Already queued?
  const pending = pendingLookups.get(addr);
  if (pending) return pending;
  
  // Create lookup promise
  const promise = getDexForPool(addr, topic0).finally(() => {
    pendingLookups.delete(addr);
  });
  
  pendingLookups.set(addr, promise);
  return promise;
}

/**
 * Process all pending lookups (call at end of block processing)
 */
export async function flushPendingLookups(): Promise<void> {
  if (pendingLookups.size === 0) return;
  
  const lookups = [...pendingLookups.values()];
  await Promise.allSettled(lookups);
}

// ============================================================================
// FALLBACK SIGNATURE-BASED DETECTION
// ============================================================================

import { SIGNATURES } from './classifier.js';

const RAW_SIGNATURES = {
  SWAP_CL: '0x70935338e69775456a85ddef226c395fb668b63fa0115f5f20610b388e6ca9c0',
  TOKEN_EXCHANGE: '0x98de503528ee59b575ef0c0a2576a82497bfc029a5685b209e9ec333479b10a5',
};

function getFallbackDexName(topic0: string): string {
  const sig = topic0.toLowerCase();
  
  // Curve TokenExchange
  if (sig === RAW_SIGNATURES.TOKEN_EXCHANGE.toLowerCase()) {
    return 'Curve';
  }
  
  // Aerodrome Slipstream (CL) - but this should be caught by factory lookup
  if (sig === RAW_SIGNATURES.SWAP_CL.toLowerCase()) {
    return 'Aerodrome CL';
  }
  
  // These signatures are shared between DEXes, so we shouldn't use them as fallback
  // V3 signature: Uniswap V3, PancakeSwap V3, Aerodrome CL all use same sig
  // V2 signature: Uniswap V2, many forks
  // Aero signature: Aerodrome, Velodrome, Hydrex (ve3,3 forks)
  
  return 'Unknown DEX';
}

// ============================================================================
// UTILITY: Add new factory mappings at runtime
// ============================================================================

export function registerFactory(factoryAddress: string, dexName: string): void {
  FACTORY_TO_DEX[factoryAddress.toLowerCase()] = dexName;
}

export function registerCurvePool(poolAddress: string): void {
  CURVE_POOLS.add(poolAddress.toLowerCase());
}

// ============================================================================
// DEBUG: Get cache stats
// ============================================================================

export function getCacheStats(): { inMemory: number; factories: number } {
  loadCache();
  return {
    inMemory: poolCache.size,
    factories: Object.keys(FACTORY_TO_DEX).length,
  };
}