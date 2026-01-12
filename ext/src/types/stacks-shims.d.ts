// Temporary shims to satisfy TypeScript module resolution for stacks packages in bundler mode.
declare module '@stacks/wallet-sdk' {
  export type Wallet = any;
  export function generateWallet(args: any): Promise<Wallet>;
  export function generateNewAccount(wallet: Wallet): Wallet;
  export function getStxAddress(args: any): string;
}

declare module '@stacks/blockchain-api-client' {
  export function createClient(args: any): any;
}

declare module '@stacks/transactions' {
  export type SignedTokenTransferOptions = any;
  export function broadcastTransaction(tx: any): Promise<any>;
  export function makeContractCall(opts: any): Promise<any>;
  export function makeSTXTokenTransfer(opts: any): Promise<any>;
  export function noneCV(): any;
  export function standardPrincipalCV(address: string): any;
  export function uintCV(value: any): any;
  export function validateStacksAddress(address: string): boolean;
}
