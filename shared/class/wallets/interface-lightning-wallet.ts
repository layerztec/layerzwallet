export interface createLightningInvoiceResponse {
  invoice: string;
  serviceFeeSat: number;
}

export interface InterfaceLightningWallet {
  allowLightning(): boolean;

  payLightningInvoice(invoice: string): Promise<boolean>;

  createLightningInvoice(amountSats: number, memo: string): Promise<createLightningInvoiceResponse>;

  isInvoicePaid(invoice: string): Promise<boolean>;
}
