import { SendQuote, SendQuoteRequest } from '../../types/send-quote';

/**
 * Represents trait of a wallet: that wallet can prepare a send transaction (quote)
 * and then execute it in a separate step.
 */
export interface InterfaceSendQuotable {
  /**
   * Prepare a send transaction and estimate the fee.
   * Does NOT sign or broadcast.
   */
  getSendQuote(request: SendQuoteRequest): Promise<SendQuote>;

  /**
   * Sign and broadcast a previously prepared transaction. Returns txid.
   * @param quote - The quote from getSendQuote
   * @param mnemonic - Required for stateless wallets (EVM). Wallets that store
   *   their own secret (Breez, ARK, Spark) ignore this.
   * @param accountNumber - Required for EVM. Others ignore.
   */
  executeSendQuote(quote: SendQuote, mnemonic?: string, accountNumber?: number): Promise<string>;
}

const REQUIRED_METHODS = ['getSendQuote', 'executeSendQuote'] as const satisfies ReadonlyArray<keyof InterfaceSendQuotable>;

export function walletCanSendQuote(obj: unknown): obj is InterfaceSendQuotable {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  return REQUIRED_METHODS.every((method) => method in obj && typeof (obj as any)[method] === 'function');
}
