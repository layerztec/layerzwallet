import type { Address } from '.';

export interface RequestArguments {
  method: any;
  params?: any;
}

export interface ProviderConnectInfo {
  chainId: string;
}

export interface ProviderRpcError extends Error {
  message: string;
  code: number;
  data?: unknown;
}

export interface ProviderMessage {
  type: string;
  data: unknown;
}

export interface EIP1193Provider {
  on(event: 'connect', listener: (info: ProviderConnectInfo) => void): this;
  on(event: 'disconnect', listener: (error: ProviderRpcError) => void): this;
  /** @deprecated */
  on(event: 'close', listener: (error: Error) => void): this;
  on(event: 'chainChanged', listener: (chainId: string) => void): this;
  /** @deprecated */
  on(event: 'networkChanged', listener: (networkId: string) => void): this;
  on(event: 'accountsChanged', listener: (accounts: Address[]) => void): this;
  on(event: 'message', listener: (message: ProviderMessage) => void): this;
  /** @deprecated */
  on(event: 'notification', listener: (payload: ProviderMessage) => void): this;
  on(event: string, listener: (...args: unknown[]) => void): this;

  request: (args: RequestArguments) => Promise<unknown>;
  /** @deprecated */
  send(...args: unknown[]): unknown;
  /** @deprecated */
  sendAsync(request: object, callback: Function): void;
}
