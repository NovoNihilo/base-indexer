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
  
  // Aerodrome
  SWAP_AERO: keccak256(toBytes('Swap(address,address,uint256,uint256,uint256,uint256)')),
  
  // WETH
  DEPOSIT: keccak256(toBytes('Deposit(address,uint256)')),
  WITHDRAWAL: keccak256(toBytes('Withdrawal(address,uint256)')),
  
  // Account Abstraction (ERC-4337)
  USER_OPERATION_EVENT: keccak256(toBytes('UserOperationEvent(bytes32,address,address,uint256,bool,uint256,uint256)')),
  ACCOUNT_DEPLOYED: keccak256(toBytes('AccountDeployed(bytes32,address,address,address)')),
  USER_OP_REVERT_REASON: keccak256(toBytes('UserOperationRevertReason(bytes32,address,uint256,bytes)')),
  
  // Aave / Lending
  SUPPLY: keccak256(toBytes('Supply(address,address,address,uint256,uint16)')),
  WITHDRAW: keccak256(toBytes('Withdraw(address,address,address,uint256)')),
  BORROW: keccak256(toBytes('Borrow(address,address,address,uint256,uint8,uint256,uint16)')),
  REPAY: keccak256(toBytes('Repay(address,address,address,uint256,bool)')),
  LIQUIDATION_CALL: keccak256(toBytes('LiquidationCall(address,address,address,uint256,uint256,address,bool)')),
  FLASH_LOAN: keccak256(toBytes('FlashLoan(address,address,address,uint256,uint8,uint256,uint16)')),
  RESERVE_DATA_UPDATED: keccak256(toBytes('ReserveDataUpdated(address,uint256,uint256,uint256,uint256,uint256)')),
  
  // NFT Marketplace
  ORDER_FULFILLED: keccak256(toBytes('OrderFulfilled(bytes32,address,address,address,(uint8,address,uint256,uint256)[],(uint8,address,uint256,uint256,address)[])')),
  ORDERS_MATCHED: keccak256(toBytes('OrdersMatched(bytes32,bytes32,address,address,uint256,uint256)')),
  
  // Bridges
  SENT_MESSAGE: keccak256(toBytes('SentMessage(address,address,bytes,uint256,uint256)')),
  RELAYED_MESSAGE: keccak256(toBytes('RelayedMessage(bytes32)')),
  DEPOSIT_FINALIZED: keccak256(toBytes('DepositFinalized(address,address,address,address,uint256,bytes)')),
  WITHDRAWAL_INITIATED: keccak256(toBytes('WithdrawalInitiated(address,address,address,address,uint256,bytes)')),
  
  // Governance
  PROPOSAL_CREATED: keccak256(toBytes('ProposalCreated(uint256,address,address[],uint256[],string[],bytes[],uint256,uint256,string)')),
  VOTE_CAST: keccak256(toBytes('VoteCast(address,uint256,uint8,uint256,string)')),
  PROPOSAL_EXECUTED: keccak256(toBytes('ProposalExecuted(uint256)')),
  
  // Staking / Rewards
  STAKED: keccak256(toBytes('Staked(address,uint256)')),
  WITHDRAWN: keccak256(toBytes('Withdrawn(address,uint256)')),
  REWARD_PAID: keccak256(toBytes('RewardPaid(address,uint256)')),
  REWARDS_CLAIMED: keccak256(toBytes('RewardsClaimed(address,uint256)')),
  CLAIM: keccak256(toBytes('Claim(address,uint256)')),
  
  // Fees
  FEE_COLLECTED: keccak256(toBytes('CollectProtocol(address,address,uint128,uint128)')),
  
  // Pyth Oracle
  PRICE_FEED_UPDATE: keccak256(toBytes('PriceFeedUpdate(bytes32,uint64,int64,uint64)')),
  
  // Safe / Multisig
  SAFE_SETUP: keccak256(toBytes('SafeSetup(address,address[],uint256,address,address)')),
  EXECUTION_SUCCESS: keccak256(toBytes('ExecutionSuccess(bytes32,uint256)')),
  EXECUTION_FAILURE: keccak256(toBytes('ExecutionFailure(bytes32,uint256)')),
  ADDED_OWNER: keccak256(toBytes('AddedOwner(address)')),
  REMOVED_OWNER: keccak256(toBytes('RemovedOwner(address)')),
  
  // Farcaster
  REGISTER: keccak256(toBytes('Register(address,uint256,address,bytes32)')),
  
  // General
  OWNERSHIP_TRANSFERRED: keccak256(toBytes('OwnershipTransferred(address,address)')),
  UPGRADED: keccak256(toBytes('Upgraded(address)')),
  INITIALIZED: keccak256(toBytes('Initialized(uint8)')),
  PAUSED: keccak256(toBytes('Paused(address)')),
  UNPAUSED: keccak256(toBytes('Unpaused(address)')),
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
  | 'liquidity_add'
  | 'liquidity_remove'
  | 'liquidity_collect'
  | 'approval'
  | 'weth_wrap'
  | 'weth_unwrap'
  | 'user_operation'
  | 'account_deployed'
  | 'lending_supply'
  | 'lending_withdraw'
  | 'lending_borrow'
  | 'lending_repay'
  | 'lending_liquidation'
  | 'flash_loan'
  | 'bridge_send'
  | 'bridge_receive'
  | 'staking'
  | 'reward_claim'
  | 'governance'
  | 'oracle_update'
  | 'multisig_exec'
  | 'ownership_change'
  | 'contract_upgrade'
  | 'pool_sync'
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
  
  // Pool sync
  if (sig === SIGNATURES.SYNC.toLowerCase()) return 'pool_sync';
  
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
      sig === SIGNATURES.FEE_COLLECTED.toLowerCase()) {
    return 'liquidity_collect';
  }
  
  // Account Abstraction
  if (sig === SIGNATURES.USER_OPERATION_EVENT.toLowerCase() ||
      sig === SIGNATURES.USER_OP_REVERT_REASON.toLowerCase()) {
    return 'user_operation';
  }
  if (sig === SIGNATURES.ACCOUNT_DEPLOYED.toLowerCase()) return 'account_deployed';
  
  // Lending
  if (sig === SIGNATURES.SUPPLY.toLowerCase()) return 'lending_supply';
  if (sig === SIGNATURES.WITHDRAW.toLowerCase()) return 'lending_withdraw';
  if (sig === SIGNATURES.BORROW.toLowerCase()) return 'lending_borrow';
  if (sig === SIGNATURES.REPAY.toLowerCase()) return 'lending_repay';
  if (sig === SIGNATURES.LIQUIDATION_CALL.toLowerCase()) return 'lending_liquidation';
  if (sig === SIGNATURES.FLASH_LOAN.toLowerCase() ||
      sig === SIGNATURES.FLASH_V3.toLowerCase()) {
    return 'flash_loan';
  }
  
  // Bridge events
  if (sig === SIGNATURES.SENT_MESSAGE.toLowerCase() ||
      sig === SIGNATURES.WITHDRAWAL_INITIATED.toLowerCase()) {
    return 'bridge_send';
  }
  if (sig === SIGNATURES.RELAYED_MESSAGE.toLowerCase() ||
      sig === SIGNATURES.DEPOSIT_FINALIZED.toLowerCase()) {
    return 'bridge_receive';
  }
  
  // Staking & Rewards
  if (sig === SIGNATURES.STAKED.toLowerCase()) return 'staking';
  if (sig === SIGNATURES.REWARD_PAID.toLowerCase() ||
      sig === SIGNATURES.REWARDS_CLAIMED.toLowerCase() ||
      sig === SIGNATURES.CLAIM.toLowerCase()) {
    return 'reward_claim';
  }
  
  // Governance
  if (sig === SIGNATURES.PROPOSAL_CREATED.toLowerCase() ||
      sig === SIGNATURES.VOTE_CAST.toLowerCase() ||
      sig === SIGNATURES.PROPOSAL_EXECUTED.toLowerCase()) {
    return 'governance';
  }
  
  // Oracle
  if (sig === SIGNATURES.PRICE_FEED_UPDATE.toLowerCase() ||
      sig === SIGNATURES.RESERVE_DATA_UPDATED.toLowerCase()) {
    return 'oracle_update';
  }
  
  // Multisig
  if (sig === SIGNATURES.EXECUTION_SUCCESS.toLowerCase() ||
      sig === SIGNATURES.EXECUTION_FAILURE.toLowerCase() ||
      sig === SIGNATURES.SAFE_SETUP.toLowerCase()) {
    return 'multisig_exec';
  }
  
  // Ownership / Upgrades
  if (sig === SIGNATURES.OWNERSHIP_TRANSFERRED.toLowerCase() ||
      sig === SIGNATURES.ADDED_OWNER.toLowerCase() ||
      sig === SIGNATURES.REMOVED_OWNER.toLowerCase()) {
    return 'ownership_change';
  }
  if (sig === SIGNATURES.UPGRADED.toLowerCase()) return 'contract_upgrade';
  
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