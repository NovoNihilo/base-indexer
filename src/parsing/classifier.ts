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
  FLASH_V3: keccak256(toBytes('Flash(address,address,uint256,uint256,uint256,uint256)')),
  INCREASE_LIQUIDITY: keccak256(toBytes('IncreaseLiquidity(uint256,uint128,uint256,uint256)')),
  DECREASE_LIQUIDITY: keccak256(toBytes('DecreaseLiquidity(uint256,uint128,uint256,uint256)')),
  POOL_CREATED_V3: keccak256(toBytes('PoolCreated(address,address,uint24,int24,address)')),
  
  // Aerodrome / Velodrome
  SWAP_AERO: keccak256(toBytes('Swap(address,address,uint256,uint256,uint256,uint256)')),
  NOTIFY_REWARD: keccak256(toBytes('NotifyReward(address,address,uint256)')),
  CLAIMED_AERO: keccak256(toBytes('Claimed(address,address,uint256,uint256)')),
  DEPOSIT_GAUGE: keccak256(toBytes('Deposit(address,address,uint256)')),
  WITHDRAW_GAUGE: keccak256(toBytes('Withdraw(address,address,uint256)')),
  VOTED: keccak256(toBytes('Voted(address,address,uint256,uint256,uint256,uint256,uint256)')),
  
  // Aerodrome Slipstream (CL)
  SWAP_CL: '0x70935338e69775456a85ddef226c395fb668b63fa0115f5f20610b388e6ca9c0',
  
  // WETH
  DEPOSIT: keccak256(toBytes('Deposit(address,uint256)')),
  WITHDRAWAL: keccak256(toBytes('Withdrawal(address,uint256)')),
  
  // Account Abstraction (ERC-4337)
  USER_OPERATION_EVENT: keccak256(toBytes('UserOperationEvent(bytes32,address,address,uint256,bool,uint256,uint256)')),
  ACCOUNT_DEPLOYED: keccak256(toBytes('AccountDeployed(bytes32,address,address,address)')),
  
  // Staking & Rewards
  REWARD_PAID: keccak256(toBytes('RewardPaid(address,uint256)')),
  REWARD_ADDED: keccak256(toBytes('RewardAdded(uint256)')),
  STAKED: keccak256(toBytes('Staked(address,uint256)')),
  WITHDRAWN: keccak256(toBytes('Withdrawn(address,uint256)')),
  
  // Curve
  TOKEN_EXCHANGE: keccak256(toBytes('TokenExchange(address,int128,uint256,int128,uint256)')),
  TOKEN_EXCHANGE_UNDERLYING: keccak256(toBytes('TokenExchangeUnderlying(address,int128,uint256,int128,uint256)')),
  ADD_LIQUIDITY_CURVE: keccak256(toBytes('AddLiquidity(address,uint256[2],uint256[2],uint256,uint256)')),
  REMOVE_LIQUIDITY_CURVE: keccak256(toBytes('RemoveLiquidity(address,uint256[2],uint256[2],uint256)')),
  
  // NFT Position Manager
  COLLECT_FEES: keccak256(toBytes('Collect(uint256,address,uint256,uint256)')),
  
  // Protocol fees
  FEES_COLLECTED: keccak256(toBytes('Fees(address,uint256,uint256)')),
  
  // Ownership / Admin
  OWNERSHIP_TRANSFERRED: keccak256(toBytes('OwnershipTransferred(address,address)')),
  
  // Pair/Pool created
  PAIR_CREATED: keccak256(toBytes('PairCreated(address,address,address,uint256)')),
};

// Also store raw hex for events we couldn't compute
const RAW_SIGNATURES = {
  // Aerodrome Slipstream swap
  SWAP_CL: '0x70935338e69775456a85ddef226c395fb668b63fa0115f5f20610b388e6ca9c0'.toLowerCase(),
  // Aerodrome NotifyReward
  NOTIFY_REWARD: '0xf8e1a15aba9398e019f0b49df1a4fde98ee17ae345cb5f6b5e2c27f5033e8ce7'.toLowerCase(),
  // Aerodrome Claimed
  CLAIMED_AERO: '0xf208f4912782fd25c7f114ca3723a2d5dd6f3bcc3ac8db5af63baa85f711d5ec'.toLowerCase(),
  // Gauge Deposit
  DEPOSIT_GAUGE: '0x40d0efd1a53d60ecbf40971b9daf7dc90178c3aadc7aab1765632738fa8b8f01'.toLowerCase(),
  // Gauge Withdraw
  WITHDRAW_GAUGE: '0x0c396cd989a39f4459b5fa1aed6a9a8dcdbc45908acfd67e028cd568da98982c'.toLowerCase(),
  // Curve TokenExchange
  TOKEN_EXCHANGE: '0x98de503528ee59b575ef0c0a2576a82497bfc029a5685b209e9ec333479b10a5'.toLowerCase(),
  // NFT Mint (position)
  MINT_POSITION: '0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde'.toLowerCase(),
  // NFT Burn (position)
  BURN_POSITION: '0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f'.toLowerCase(),
  // Flash loan
  FLASH: '0x1f89f96333d3133000ee447473151fa9606543368f02271c9d95ae14f13bcc67'.toLowerCase(),
  // Pool Created
  POOL_CREATED: '0x1c8ab8c7f45390d58f58f1d655213a82cca5d12179761a87c16f098813b8f211'.toLowerCase(),
  // Collect fees
  COLLECT: '0x8903a5b5d08a841e7f68438387f1da20c84dea756379ed37e633ff3854b99b84'.toLowerCase(),
  // IncreaseLiquidity
  INCREASE_LIQ: '0x26f6a048ee9138f2c0ce266f322cb99228e8d619ae2bff30c67f8dcf9d2377b4'.toLowerCase(),
  // Voted
  VOTED: '0x4651e49a0e85b3a1a77f231148d863791c54751ca6cca65ee4639fb2df93552f'.toLowerCase(),
  // DecreaseLiquidity
  DECREASE_LIQ: '0x93485dcd31a905e3ffd7b012abe3438fa8fa77f98ddc9f50e879d3fa7ccdc324'.toLowerCase(),
  // UserOperationEvent
  USER_OP: '0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f'.toLowerCase(),
  // Protocol fees
  FEES: '0xeddffc43f467c90b12f0bb9fcf1edf59086a6f01a0743bcaab6a5410a9efad37'.toLowerCase(),
  // Another swap variant
  SWAP_ALT: '0xbb47ee3e183a558b1a2ff0874b079f3fc5478b7454eacf2bfc5af2ff5878f972'.toLowerCase(),
  // RewardPaid
  REWARD_PAID: '0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f'.toLowerCase(),
  // ClaimRewards
  CLAIM_REWARDS: '0xfc6d279aa22eb9d6ba081f1bd2443d1e1c8eb3bcf089906d78064616798fbad0'.toLowerCase(),
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
  | 'dex_swap_curve'
  | 'liquidity_add'
  | 'liquidity_remove'
  | 'liquidity_collect'
  | 'pool_created'
  | 'pool_sync'
  | 'approval'
  | 'weth_wrap'
  | 'weth_unwrap'
  | 'gauge_deposit'
  | 'gauge_withdraw'
  | 'reward_notify'
  | 'reward_claim'
  | 'vote'
  | 'user_operation'
  | 'flash_loan'
  | 'nft_position_mint'
  | 'nft_position_burn'
  | 'protocol_fees'
  | 'ownership_change'
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
  
  // Check raw signatures first (exact matches for events we couldn't compute)
  if (sig === RAW_SIGNATURES.SWAP_CL) return 'dex_swap_aero';
  if (sig === RAW_SIGNATURES.NOTIFY_REWARD) return 'reward_notify';
  if (sig === RAW_SIGNATURES.CLAIMED_AERO) return 'reward_claim';
  if (sig === RAW_SIGNATURES.DEPOSIT_GAUGE) return 'gauge_deposit';
  if (sig === RAW_SIGNATURES.WITHDRAW_GAUGE) return 'gauge_withdraw';
  if (sig === RAW_SIGNATURES.TOKEN_EXCHANGE) return 'dex_swap_curve';
  if (sig === RAW_SIGNATURES.MINT_POSITION) return 'nft_position_mint';
  if (sig === RAW_SIGNATURES.BURN_POSITION) return 'nft_position_burn';
  if (sig === RAW_SIGNATURES.FLASH) return 'flash_loan';
  if (sig === RAW_SIGNATURES.POOL_CREATED) return 'pool_created';
  if (sig === RAW_SIGNATURES.COLLECT) return 'liquidity_collect';
  if (sig === RAW_SIGNATURES.INCREASE_LIQ) return 'liquidity_add';
  if (sig === RAW_SIGNATURES.VOTED) return 'vote';
  if (sig === RAW_SIGNATURES.DECREASE_LIQ) return 'liquidity_remove';
  if (sig === RAW_SIGNATURES.USER_OP) return 'user_operation';
  if (sig === RAW_SIGNATURES.FEES) return 'protocol_fees';
  if (sig === RAW_SIGNATURES.SWAP_ALT) return 'dex_swap_v2';
  if (sig === RAW_SIGNATURES.REWARD_PAID) return 'reward_claim';
  if (sig === RAW_SIGNATURES.CLAIM_REWARDS) return 'reward_claim';
  
  // WETH events
  if (sig === SIGNATURES.DEPOSIT.toLowerCase()) return 'weth_wrap';
  if (sig === SIGNATURES.WITHDRAWAL.toLowerCase()) return 'weth_unwrap';
  
  // DEX swaps
  if (sig === SIGNATURES.SWAP_V2.toLowerCase()) return 'dex_swap_v2';
  if (sig === SIGNATURES.SWAP_V3.toLowerCase()) return 'dex_swap_v3';
  if (sig === SIGNATURES.SWAP_AERO.toLowerCase()) return 'dex_swap_aero';
  
  // Pool sync
  if (sig === SIGNATURES.SYNC.toLowerCase()) return 'pool_sync';
  
  // Pool/Pair created
  if (sig === SIGNATURES.PAIR_CREATED.toLowerCase()) return 'pool_created';
  if (sig === SIGNATURES.POOL_CREATED_V3.toLowerCase()) return 'pool_created';
  
  // Liquidity events
  if (sig === SIGNATURES.MINT_V2.toLowerCase() || 
      sig === SIGNATURES.MINT_V3.toLowerCase() ||
      sig === SIGNATURES.INCREASE_LIQUIDITY.toLowerCase()) {
    return 'liquidity_add';
  }
  if (sig === SIGNATURES.BURN_V2.toLowerCase() ||
      sig === SIGNATURES.BURN_V3.toLowerCase() ||
      sig === SIGNATURES.DECREASE_LIQUIDITY.toLowerCase()) {
    return 'liquidity_remove';
  }
  if (sig === SIGNATURES.COLLECT_V3.toLowerCase() ||
      sig === SIGNATURES.COLLECT_FEES.toLowerCase()) {
    return 'liquidity_collect';
  }
  
  // Flash loans
  if (sig === SIGNATURES.FLASH_V3.toLowerCase()) return 'flash_loan';
  
  // Account Abstraction
  if (sig === SIGNATURES.USER_OPERATION_EVENT.toLowerCase()) return 'user_operation';
  if (sig === SIGNATURES.ACCOUNT_DEPLOYED.toLowerCase()) return 'user_operation';
  
  // Staking & Rewards
  if (sig === SIGNATURES.REWARD_PAID.toLowerCase()) return 'reward_claim';
  if (sig === SIGNATURES.STAKED.toLowerCase()) return 'gauge_deposit';
  if (sig === SIGNATURES.WITHDRAWN.toLowerCase()) return 'gauge_withdraw';
  
  // Ownership
  if (sig === SIGNATURES.OWNERSHIP_TRANSFERRED.toLowerCase()) return 'ownership_change';
  
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
         sig === SIGNATURES.SWAP_AERO.toLowerCase() ||
         sig === RAW_SIGNATURES.SWAP_CL ||
         sig === RAW_SIGNATURES.TOKEN_EXCHANGE ||
         sig === RAW_SIGNATURES.SWAP_ALT;
}
