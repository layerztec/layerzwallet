/**
 * Symbiosis Finance crosschain API client.
 * @see https://docs.symbiosis.finance
 */

const BASE_URL = 'https://api.symbiosis.finance/crosschain';
const REQUEST_TIMEOUT = 5_000;

export class SymbiosisApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: any
  ) {
    super(message);
    this.name = 'SymbiosisApiError';
  }
}

export interface SymbiosisTokenAmount {
  chainId: number;
  address: string;
  amount: string;
  decimals: number;
}

export interface SymbiosisTokenOut {
  chainId: number;
  address: string;
  decimals: number;
}

export interface SymbiosisSwapRequest {
  tokenAmountIn: SymbiosisTokenAmount;
  tokenOut: SymbiosisTokenOut;
  from: string;
  to: string;
  slippage: number;
}

export interface SymbiosisTokenInfo {
  chainId: number;
  address: string;
  amount: string;
  decimals: number;
  symbol?: string;
}

export interface SymbiosisFeeItem {
  provider: string;
  value: SymbiosisTokenInfo;
  save?: SymbiosisTokenInfo;
  description?: string;
}

export interface SymbiosisSwapResponse {
  kind: 'onchain-swap' | 'crosschain-swap' | 'wrap' | 'unwrap' | 'bridge' | 'from-btc-swap';
  type: 'evm' | 'tron' | 'btc' | 'ton' | 'solana';
  tokenAmountOut: SymbiosisTokenInfo;
  estimatedTime: number;
  fee?: SymbiosisTokenInfo;
  fees: SymbiosisFeeItem[];
  tx: {
    depositAddress?: string;
    expiresAt?: string;
    // EVM fields (not used for BTC source)
    chainId?: number;
    data?: string;
    to?: string;
    value?: string;
  };
}

export interface SymbiosisTxStatus {
  status: {
    code: number;
    text: string;
  };
}

export class SymbiosisApi {
  private async request<T>(method: string, path: string, body?: object): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = data.message || data.error || `Symbiosis API error: ${response.status}`;
        throw new SymbiosisApiError(message, response.status, data);
      }

      return data as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async swap(request: SymbiosisSwapRequest): Promise<SymbiosisSwapResponse> {
    return this.request<SymbiosisSwapResponse>('POST', '/v2/swap', request);
  }

  async getTxStatus(chainId: number, txHash: string): Promise<SymbiosisTxStatus> {
    return this.request<SymbiosisTxStatus>('GET', `/v2/tx/${chainId}/${encodeURIComponent(txHash)}`);
  }
}
