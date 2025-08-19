export type NetworkInfo = {
  chainId: number;
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
