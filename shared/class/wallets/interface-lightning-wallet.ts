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

export interface InterfaceLightningWallet {
  allowLightning: true;

  payLightningInvoice(invoice: string, maxFeePercentage?: number): Promise<boolean>;

  createLightningInvoice(amountSats: number, memo: string): Promise<createLightningInvoiceResponse>;

  isInvoicePaid(invoice: string): Promise<boolean>;

  fetchLightningLimits(): Promise<LightningPaymentLimitsResponse>;
}
