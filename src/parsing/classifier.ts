import { keccak256, toHex } from 'viem';

const TRANSFER_TOPIC = keccak256(toHex('Transfer(address,address,uint256)'));

export type EventType =
  | 'eth_transfer'
  | 'contract_creation'
  | 'transfer_event'
  | 'contract_call';

export function classifyTx(tx: {
  hash: string;
  to: string | null;
  value: bigint;
  input: string;
}): EventType {
  if (tx.to === null) return 'contract_creation';
  if (tx.value > 0n && tx.input === '0x') return 'eth_transfer';
  return 'contract_call';
}

export function classifyLog(topic0: string | undefined): 'transfer_event' | null {
  if (topic0?.toLowerCase() === TRANSFER_TOPIC.toLowerCase()) {
    return 'transfer_event';
  }
  return null;
}

export { TRANSFER_TOPIC };
