import type { EIP1193Provider } from './eip1193';
import type { EIP1102, EIP3085, EIP3326, EIP747 } from './standard-methods';
import type { MakeRequestMethods } from './utils';

export interface JsonRpcRequest {
  id: string | undefined;
  jsonrpc: '2.0';
  method: string;
  params?: any[];
}

export interface JsonRpcResponse {
  id: string | undefined;
  jsonrpc: '2.0';
  method: string;
  result?: unknown;
  error?: Error;
}

export type JsonRpcCallback = (error: Error, response: JsonRpcResponse) => unknown;

export interface Web3WalletPermission {
  // The name of the method corresponding to the permission
  parentCapability: string;

  // The date the permission was granted, in UNIX epoch time
  date?: number;
}

export type RequestedPermissions = {
  [K in keyof MetaMaskMethods]?: {};
};

export type MetaMaskMethods = EIP747 &
  EIP1102 &
  EIP3085 &
  EIP3326 & {
    wallet_getPermissions: [[] | undefined, Web3WalletPermission[]];
    wallet_requestPermissions: [RequestedPermissions[], Web3WalletPermission[]];
    wallet_registerOnboarding: [[] | undefined, boolean];
    /** Mobile Specific RPC Method */
    wallet_scanQRCode: [[string] | [] | undefined, string];
  };

export interface MetaMaskProvider extends EIP1193Provider {
  isMetaMask: true;
  isConnected(): boolean;

  _metamask: {
    /** **Experimental** */
    isUnlocked(): Promise<boolean>;
  };

  /** @deprecated */
  chainId: string;
  /** @deprecated */
  networkVersion: string;
  /** @deprecated */
  selectedAddress: string;
  /** @deprecated */
  enable(): Promise<string[]>;

  request: MakeRequestMethods<MetaMaskMethods>;

  /** @deprecated */
  send(payload: JsonRpcRequest, callback: JsonRpcCallback): void;
  send(method: string, params?: unknown[]): Promise<JsonRpcResponse>;
  send(payload: JsonRpcRequest): unknown;
  /** @deprecated */
  sendAsync(payload: JsonRpcRequest, callback: JsonRpcCallback): void;
}
