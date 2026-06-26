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

  /**
   * Checks whether an invoice that this wallet issued has been paid, looking it up by the BOLT11
   * payment hash (aka preimage hash, i.e. `sha256(preimage)`, hex-encoded).
   *
   * The argument is intentionally hash-only so callers do not have to retain the full BOLT11
   * string after creating the invoice.
   */
  isInvoicePaidByHash(preimageHash: string): Promise<boolean>;

  fetchLightningLimits(): Promise<LightningPaymentLimitsResponse>;

  allowLightning(): boolean;
}

const REQUIRED_METHODS = ['payLightningInvoice', 'createLightningInvoice', 'isInvoicePaid', 'isInvoicePaidByHash', 'fetchLightningLimits', 'allowLightning'] as const satisfies ReadonlyArray<
  keyof InterfaceLightningWallet
>;

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
