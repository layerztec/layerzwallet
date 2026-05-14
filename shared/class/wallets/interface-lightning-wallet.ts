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
  payLightningInvoice(invoice: string, maxFeePercentage?: number): Promise<boolean>;

  createLightningInvoice(amountSats: number, memo: string): Promise<createLightningInvoiceResponse>;

  isInvoicePaid(invoice: string): Promise<boolean>;

  fetchLightningLimits(): Promise<LightningPaymentLimitsResponse>;

  allowLightning(): boolean;
}

const REQUIRED_METHODS = ['payLightningInvoice', 'createLightningInvoice', 'isInvoicePaid', 'fetchLightningLimits', 'allowLightning'] as const satisfies ReadonlyArray<keyof InterfaceLightningWallet>;

/**
 * type guard
 */
export function walletSupportsLightning(obj: unknown): obj is InterfaceLightningWallet {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  // Check all required methods exist and are functions
  return REQUIRED_METHODS.every((method) => method in obj && typeof (obj as any)[method] === 'function');
}
