export interface TokenInfo {
  readonly id: string;
  readonly chainId: number;
  readonly name: string;
  readonly decimals: number;
  readonly symbol: string;
  readonly logoURI?: string;
  readonly tags?: string[];
  readonly extensions?: {
    readonly [key: string]: string | number | boolean | null;
  };
}

/* Same as TokenInfo, but with a balance */
export interface CachedTokenInfo extends TokenInfo {
  readonly balance: string | undefined;
}

export interface EVMTokenInfo extends Omit<TokenInfo, 'id'> {
  readonly address: string;
}

export interface LiquidTokenInfo extends Omit<TokenInfo, 'id'> {
  readonly assetId: string;
}

export interface SparkTokenInfo extends Omit<TokenInfo, 'id'> {
  readonly tokenIdentifier: string;
}

export interface NftInfo {
  readonly contractAddress: string;

  /* actual token number inside contract */
  readonly tokenId: string;

  readonly collectionName: string;
  readonly name: string;
  readonly description: string;
  readonly image: string;
}
