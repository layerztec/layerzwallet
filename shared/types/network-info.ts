export type NetworkInfo = {
  chainId: number;
  displayName: string;
  ticker: string;
  decimals: number;
  explorerUrl: string;
  rpcUrl: string;
  sortIndex: number;
  knowMoreUrl?: string;
  isTestnet?: boolean;
  isEVM?: boolean;
  etherScanApiUrl?: string;
};
