/**
 * represents trait of a wallet: that wallet can have only one address (unlike UTXO-based wallets like bitcoin),
 * and can do transfers natively on that address
 */
export interface InterfaceAccountBasedWallet {
  getOffchainReceiveAddress(): Promise<string>;

  pay(receiverAddress: string, amountSats: number): Promise<string>;

  getOffchainBalance(): Promise<number>;
}
