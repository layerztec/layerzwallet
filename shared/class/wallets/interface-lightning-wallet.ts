export interface InterfaceLightningWallet {
  allowLightning(): boolean;

  payLightningInvoice(invoice: string): Promise<boolean>;

  createLightningInvoice(amountSats: number, memo: string): Promise<string>;

  isInvoicePaid(invoice: string): Promise<boolean>;
}
