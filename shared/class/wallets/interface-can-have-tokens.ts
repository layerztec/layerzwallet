import { CachedTokenInfo } from '../../types/token-info';

/**
 * represents trait of a wallet: that wallet can have tokens, can send tokens
 */
export interface InterfaceCanHaveTokens {
  /**
   *
   * @param tokenId - token identifier (for EVM its a smart contract address )
   * @param amount
   * @param address
   * @param memo - optional memo for the transaction (supported only for some networks)
   */
  transferToken(tokenId: string, amount: bigint, address: string, memo?: string): Promise<string>;

  fetchTokenBalances(): Promise<void>;

  getTokenBalances(): CachedTokenInfo[];
}

/**
 * Required method names for InterfaceCanHaveTokens.
 * TypeScript will error if these don't match the interface keys.
 */
const REQUIRED_METHODS = ['transferToken', 'fetchTokenBalances', 'getTokenBalances'] as const satisfies ReadonlyArray<keyof InterfaceCanHaveTokens>;

/**
 * Type guard to check if an object implements InterfaceCanHaveTokens
 *
 * @param obj - The object to check
 * @returns true if the object implements InterfaceCanHaveTokens
 *
 * @remarks
 * This type guard is kept in sync with the interface via the REQUIRED_METHODS constant.
 * If the interface changes, TypeScript will produce a compile error.
 */
export function walletCanHaveTokens(obj: unknown): obj is InterfaceCanHaveTokens {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  // Check all required methods exist and are functions
  return REQUIRED_METHODS.every((method) => method in obj && typeof (obj as any)[method] === 'function');
}
