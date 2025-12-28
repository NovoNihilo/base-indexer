/**
 * Pool Registry - Maps pool addresses to their parent DEX
 * 
 * Strategy: When we encounter a Swap event from an unknown pool,
 * we query the pool's factory() function to determine which DEX it belongs to.
 * Results are cached in SQLite for fast lookups.
 */

import { db } from '../storage/db.js';
import { client } from '../rpc.js';
import type { Address } from 'viem';

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

const UNISWAP_V4_POOL_MANAGER = '0x498581ff718922c3f8e6a244956af099b2652b2b';

const CURVE_POOLS = new Set([
  '0x7f90122bf0700f9e7e1f688fe926940e8839f353',
  '0x6e53131f68a034873b6bfa15502af094ef0c5854',
]);

// ============================================================================
// IN-MEMORY CACHE
// ============================================================================

const poolCache = new Map<string, string>();
let cacheLoaded = false;

let getPoolDexStmt: ReturnType<typeof db.prepare> | null = null;
let insertPoolDexStmt: ReturnType<typeof db.prepare> | null = null;

function initStatements() {
  if (!getPoolDexStmt) {
    try {
      getPoolDexStmt = db.prepare(`SELECT dexName FROM pool_dex_cache WHERE poolAddress = ?`);
      insertPoolDexStmt = db.prepare(`INSERT OR REPLACE INTO pool_dex_cache (poolAddress, factoryAddress, dexName) VALUES (?, ?, ?)`);
    } catch (e) {
      console.error('Failed to init pool cache statements:', e);
    }
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
    console.error('Failed to load pool cache:', e);
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
  } catch (e) {
    // Pool doesn't have factory() function
    return null;
  }
}

// ============================================================================
// MAIN API
// ============================================================================

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
  if (getPoolDexStmt) {
    try {
      const row = getPoolDexStmt.get(addr) as { dexName: string } | undefined;
      if (row) {
        poolCache.set(addr, row.dexName);
        return row.dexName;
      }
    } catch (e) {
      // Ignore
    }
  }
  
  // 5. Query factory on-chain
  console.log(`🔍 Querying factory for pool ${addr.slice(0, 10)}...`);
  const factoryAddr = await queryPoolFactory(addr);
  
  if (factoryAddr) {
    console.log(`   Factory: ${factoryAddr}`);
    const dexName = FACTORY_TO_DEX[factoryAddr];
    if (dexName) {
      console.log(`   ✓ Identified as ${dexName}`);
      // Cache the result
      poolCache.set(addr, dexName);
      if (insertPoolDexStmt) {
        try {
          insertPoolDexStmt.run(addr, factoryAddr, dexName);
        } catch (e) {
          console.error('Failed to cache pool:', e);
        }
      }
      return dexName;
    }
    
    // Unknown factory
    const unknownName = `Unknown (${factoryAddr.slice(0, 10)}...)`;
    console.log(`   ⚠ Unknown factory: ${factoryAddr}`);
    poolCache.set(addr, unknownName);
    if (insertPoolDexStmt) {
      try {
        insertPoolDexStmt.run(addr, factoryAddr, unknownName);
      } catch (e) {
        // Ignore
      }
    }
    return unknownName;
  }
  
  // No factory function
  console.log(`   ✗ No factory() function`);
  if (topic0) {
    const fallbackName = getFallbackDexName(topic0);
    if (fallbackName !== 'Unknown DEX') {
      poolCache.set(addr, fallbackName);
      if (insertPoolDexStmt) {
        try {
          insertPoolDexStmt.run(addr, '', fallbackName);
        } catch (e) {
          // Ignore
        }
      }
      return fallbackName;
    }
  }
  
  return 'Unknown DEX';
}

/**
 * Synchronous version - only returns cached results
 */
export function getDexForPoolSync(poolAddress: string): string | null {
  const addr = poolAddress.toLowerCase();
  
  if (addr === UNISWAP_V4_POOL_MANAGER) {
    return 'Uniswap V4';
  }
  
  if (CURVE_POOLS.has(addr)) {
    return 'Curve';
  }
  
  loadCache();
  const cached = poolCache.get(addr);
  if (cached) {
    return cached;
  }
  
  initStatements();
  if (getPoolDexStmt) {
    try {
      const row = getPoolDexStmt.get(addr) as { dexName: string } | undefined;
      if (row) {
        poolCache.set(addr, row.dexName);
        return row.dexName;
      }
    } catch (e) {
      // Ignore
    }
  }
  
  return null;
}

// ============================================================================
// ASYNC QUEUE
// ============================================================================

const pendingLookups = new Map<string, { promise: Promise<string>; topic0?: string }>();

export function queuePoolLookup(poolAddress: string, topic0?: string): void {
  const addr = poolAddress.toLowerCase();
  
  if (pendingLookups.has(addr)) return;
  if (poolCache.has(addr)) return;
  
  const promise = getDexForPool(addr, topic0).catch(e => {
    console.error(`Failed to lookup pool ${addr}:`, e);
    return 'Unknown DEX';
  }).finally(() => {
    pendingLookups.delete(addr);
  });
  
  pendingLookups.set(addr, { promise, topic0 });
}

export async function flushPendingLookups(): Promise<void> {
  const count = pendingLookups.size;
  if (count === 0) return;
  
  console.log(`🔄 Flushing ${count} pending pool lookups...`);
  const lookups = [...pendingLookups.values()].map(v => v.promise);
  await Promise.allSettled(lookups);
  console.log(`✓ Pool lookups complete. Cache size: ${poolCache.size}`);
}

// ============================================================================
// FALLBACK
// ============================================================================

import { SIGNATURES } from './classifier.js';

const RAW_SIGNATURES = {
  SWAP_CL: '0x70935338e69775456a85ddef226c395fb668b63fa0115f5f20610b388e6ca9c0',
  TOKEN_EXCHANGE: '0x98de503528ee59b575ef0c0a2576a82497bfc029a5685b209e9ec333479b10a5',
};

function getFallbackDexName(topic0: string): string {
  const sig = topic0.toLowerCase();
  
  if (sig === RAW_SIGNATURES.TOKEN_EXCHANGE.toLowerCase()) {
    return 'Curve';
  }
  
  if (sig === RAW_SIGNATURES.SWAP_CL.toLowerCase()) {
    return 'Aerodrome CL';
  }
  
  return 'Unknown DEX';
}

// ============================================================================
// UTILITIES
// ============================================================================

export function registerFactory(factoryAddress: string, dexName: string): void {
  FACTORY_TO_DEX[factoryAddress.toLowerCase()] = dexName;
}

export function registerCurvePool(poolAddress: string): void {
  CURVE_POOLS.add(poolAddress.toLowerCase());
}

export function getCacheStats(): { inMemory: number; factories: number; pending: number } {
  loadCache();
  return {
    inMemory: poolCache.size,
    factories: Object.keys(FACTORY_TO_DEX).length,
    pending: pendingLookups.size,
  };
}