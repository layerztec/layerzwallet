/**
 * represents trait of a wallet: that wallet can have only one address (unlike UTXO-based wallets like bitcoin),
 * and can do transfers natively on that address
 */
export interface InterfaceAccountBasedWallet {
  getOffchainReceiveAddress(): Promise<string>;

  pay(receiverAddress: string, amountSats: number): Promise<string>;

  getOffchainBalance(): Promise<number>;
}

/**
 * Required method names for InterfaceAccountBasedWallet.
 * TypeScript will error if these don't match the interface keys.
 */
const REQUIRED_METHODS = ['getOffchainReceiveAddress', 'pay', 'getOffchainBalance'] as const satisfies ReadonlyArray<keyof InterfaceAccountBasedWallet>;

/**
 * Type guard to check if an object implements InterfaceAccountBasedWallet (single-address wallet
 * that can transfer its native coin via `pay`). Kept in sync with the interface via REQUIRED_METHODS.
 */
export function walletIsAccountBased(obj: unknown): obj is InterfaceAccountBasedWallet {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  return REQUIRED_METHODS.every((method) => method in obj && typeof (obj as any)[method] === 'function');
}
