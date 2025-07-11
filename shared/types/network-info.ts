export type NetworkInfo = {
  chainId: number;
  ticker: string;
  decimals: number;
  explorerUrl: string;
  rpcUrl: string;
  knowMoreUrl?: string;
  isTestnet?: boolean;
  isEVM?: boolean;
};
