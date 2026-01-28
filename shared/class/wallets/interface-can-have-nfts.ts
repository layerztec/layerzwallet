import { NftInfo } from '../../types/token-info';

/**
 * represents trait of a wallet: that wallet can have tokens, can send tokens
 */
export interface InterfaceCanHaveNfts {
  /**
   * does a network request to fetch the NFTs
   * and returns them
   */
  fetchNfts(): Promise<NftInfo[]>;

  /**
   * transfers an NFT to a given address.
   * returns txid.
   */
  transferNFT(nft: NftInfo, address: string): Promise<string>;

  _lastNftsFetch: number;
}

/**
 * Required method names for InterfaceCanHaveNfts.
 * TypeScript will error if these don't match the interface keys.
 */
const REQUIRED_METHODS = ['fetchNfts', 'transferNFT'] as const satisfies ReadonlyArray<keyof InterfaceCanHaveNfts>;

/**
 * Required property names for InterfaceCanHaveNfts.
 * TypeScript will error if these don't match the interface keys.
 */
const REQUIRED_PROPERTIES = ['_lastNftsFetch'] as const satisfies ReadonlyArray<keyof InterfaceCanHaveNfts>;

/**
 * Type guard to check if an object implements InterfaceCanHaveNfts
 *
 * @param obj - The object to check
 * @returns true if the object implements InterfaceCanHaveNfts
 *
 * @remarks
 * This type guard is kept in sync with the interface via the REQUIRED_METHODS and REQUIRED_PROPERTIES constants.
 * If the interface changes, TypeScript will produce a compile error.
 */
export function walletCanHaveNfts(obj: unknown): obj is InterfaceCanHaveNfts {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  // Check all required methods exist and are functions
  const hasAllMethods = REQUIRED_METHODS.every((method) => method in obj && typeof (obj as any)[method] === 'function');

  // Check all required properties exist
  const hasAllProperties = REQUIRED_PROPERTIES.every((property) => property in obj);

  return hasAllMethods && hasAllProperties;
}
