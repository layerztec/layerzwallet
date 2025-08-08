import { Networks } from '@shared/types/networks';

export type BaseRouteParams = Record<string, string | string[] | undefined>;

export const UNLOCK_ACTIONS = {
  ENABLE_SECURITY: 'enableSecurity',
  DISABLE_SECURITY: 'disableSecurity',
} as const;

export type UnlockAction = (typeof UNLOCK_ACTIONS)[keyof typeof UNLOCK_ACTIONS];

export type UnlockRouteParams = {
  action?: UnlockAction;
};

export type HomeRouteParams = {
  showSwapInterface?: string;
  fromNetwork?: string;
  toNetwork?: string;
  amount?: string;
};

export type DAppBrowserRouteParams = {
  url?: string;
};

export type OnrampRouteParams = {
  address: string;
  network: Networks;
};

export type ReceiveLightningRouteParams = {
  network: typeof NETWORK_SPARK | typeof NETWORK_LIQUID | typeof NETWORK_LIQUID_TESTNET;
};

export type SendArkRouteParams = {
  toAddress?: string;
  amount?: string;
};

export type SendBtcRouteParams = {
  toAddress?: string;
  amount?: string;
};

export type SendEvmRouteParams = {
  toAddress?: string;
  amount?: string;
};

export type SendLightningRouteParams = {
  network: typeof NETWORK_SPARK | typeof NETWORK_LIQUID | typeof NETWORK_LIQUID_TESTNET;
  invoice?: string;
};

export type SendLiquidRouteParams = {
  assetId?: string;
  toAddress?: string;
  amount?: string;
};

export type SendTokenEvmRouteParams = {
  contractAddress: string;
  toAddress?: string;
  amountToSend?: string;
};

export type SwapRouteParams = {
  amount?: string;
  toNetwork?: Networks;
  showSwapInterface?: string;
  fromNetwork?: string;
};

export type SwapTargetRouteParams = {
  amount?: string;
};

export type TransactionSuccessEvmRouteParams = {
  amount: string;
  amountToken?: string;
  tokenContractAddress?: string;
  recipient: string;
  network: Networks;
  transactionId: string;
  bytes: string;
};
