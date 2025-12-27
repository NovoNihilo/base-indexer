import { keccak256, toBytes } from 'viem';

// Event signatures (topic0)
export const SIGNATURES = {
  // ERC-20
  TRANSFER: keccak256(toBytes('Transfer(address,address,uint256)')),
  APPROVAL: keccak256(toBytes('Approval(address,address,uint256)')),
  
  // ERC-721 (same signature as ERC-20 Transfer)
  APPROVAL_FOR_ALL: keccak256(toBytes('ApprovalForAll(address,address,bool)')),
  
  // ERC-1155
  TRANSFER_SINGLE: keccak256(toBytes('TransferSingle(address,address,address,uint256,uint256)')),
  TRANSFER_BATCH: keccak256(toBytes('TransferBatch(address,address,address,uint256[],uint256[])')),
  
  // Uniswap V2
  SWAP_V2: keccak256(toBytes('Swap(address,uint256,uint256,uint256,uint256,address)')),
  SYNC: keccak256(toBytes('Sync(uint112,uint112)')),
  MINT_V2: keccak256(toBytes('Mint(address,uint256,uint256)')),
  BURN_V2: keccak256(toBytes('Burn(address,uint256,uint256,address)')),
  
  // Uniswap V3
  SWAP_V3: keccak256(toBytes('Swap(address,address,int256,int256,uint160,uint128,int24)')),
  MINT_V3: keccak256(toBytes('Mint(address,address,int24,int24,uint128,uint256,uint256)')),
  BURN_V3: keccak256(toBytes('Burn(address,int24,int24,uint128,uint256,uint256)')),
  COLLECT_V3: keccak256(toBytes('Collect(address,address,int24,int24,uint128,uint128)')),
  
  // Aerodrome
  SWAP_AERO: keccak256(toBytes('Swap(address,address,uint256,uint256,uint256,uint256)')),
  
  // WETH
  DEPOSIT: keccak256(toBytes('Deposit(address,uint256)')),
  WITHDRAWAL: keccak256(toBytes('Withdrawal(address,uint256)')),
};

export type TxClassification =
  | 'eth_transfer'
  | 'contract_creation'
  | 'contract_call';

export type EventType =
  | 'eth_transfer'
  | 'contract_creation'
  | 'contract_call'
  | 'erc20_transfer'
  | 'erc721_transfer'
  | 'erc1155_transfer'
  | 'dex_swap_v2'
  | 'dex_swap_v3'
  | 'dex_swap_aero'
  | 'liquidity_event'
  | 'approval'
  | 'weth_wrap'
  | 'weth_unwrap'
  | 'other';

export function classifyTx(tx: {
  to: string | null;
  value: bigint;
  input: string;
}): TxClassification {
  if (tx.to === null) return 'contract_creation';
  if (tx.value > 0n && tx.input === '0x') return 'eth_transfer';
  return 'contract_call';
}

export function classifyLog(topic0: string | undefined, topicCount: number): EventType {
  if (!topic0) return 'other';
  
  const sig = topic0.toLowerCase();
  
  // WETH events
  if (sig === SIGNATURES.DEPOSIT.toLowerCase()) return 'weth_wrap';
  if (sig === SIGNATURES.WITHDRAWAL.toLowerCase()) return 'weth_unwrap';
  
  // DEX swaps
  if (sig === SIGNATURES.SWAP_V2.toLowerCase()) return 'dex_swap_v2';
  if (sig === SIGNATURES.SWAP_V3.toLowerCase()) return 'dex_swap_v3';
  if (sig === SIGNATURES.SWAP_AERO.toLowerCase()) return 'dex_swap_aero';
  
  // Liquidity events
  if (sig === SIGNATURES.MINT_V2.toLowerCase() || 
      sig === SIGNATURES.MINT_V3.toLowerCase() ||
      sig === SIGNATURES.BURN_V2.toLowerCase() ||
      sig === SIGNATURES.BURN_V3.toLowerCase()) {
    return 'liquidity_event';
  }
  
  // ERC-1155
  if (sig === SIGNATURES.TRANSFER_SINGLE.toLowerCase()) return 'erc1155_transfer';
  if (sig === SIGNATURES.TRANSFER_BATCH.toLowerCase()) return 'erc1155_transfer';
  
  // Transfer - distinguish ERC-20 vs ERC-721 by topic count
  if (sig === SIGNATURES.TRANSFER.toLowerCase()) {
    if (topicCount === 4) return 'erc721_transfer';
    return 'erc20_transfer';
  }
  
  // Approvals
  if (sig === SIGNATURES.APPROVAL.toLowerCase() ||
      sig === SIGNATURES.APPROVAL_FOR_ALL.toLowerCase()) {
    return 'approval';
  }
  
  return 'other';
}

export function isTransferEvent(topic0: string | undefined): boolean {
  if (!topic0) return false;
  return topic0.toLowerCase() === SIGNATURES.TRANSFER.toLowerCase();
}

export function isSwapEvent(topic0: string | undefined): boolean {
  if (!topic0) return false;
  const sig = topic0.toLowerCase();
  return sig === SIGNATURES.SWAP_V2.toLowerCase() ||
         sig === SIGNATURES.SWAP_V3.toLowerCase() ||
         sig === SIGNATURES.SWAP_AERO.toLowerCase();
}
