export interface Limits {
  minSat: number;
  maxSat: number;
  maxZeroConfSat: number;
}

export interface createLightningInvoiceResponse {
  invoice: string;
  serviceFeeSat: number;
}

export interface LightningPaymentLimitsResponse {
  send: Limits;
  receive: Limits;
}

/**
 * represents trait of a wallet: that wallet can pay and receive lightning
 */
export interface InterfaceLightningWallet {
  payLightningInvoice(invoice: string): Promise<boolean>;

  createLightningInvoice(amountSats: number, memo: string): Promise<createLightningInvoiceResponse>;

  isInvoicePaid(invoice: string): Promise<boolean>;

  fetchLightningLimits(): Promise<LightningPaymentLimitsResponse>;

  allowLightning(): boolean;
}
