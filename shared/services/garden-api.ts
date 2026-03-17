/**
 * Garden Finance v2 REST API client.
 * @see https://docs.garden.finance/developers/api/
 */

const BASE_URL = 'https://api.garden.finance/v2';
const REQUEST_TIMEOUT = 5_000;

export class GardenApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: any
  ) {
    super(message);
    this.name = 'GardenApiError';
  }
}

export interface GardenQuoteItem {
  solver_id: string;
  estimated_time: number;
  source: { asset: string; amount: string; display: string; value: string };
  destination: { asset: string; amount: string; display: string; value: string };
  slippage: number;
  fee: number;
  fixed_fee: string;
}

export interface GardenQuoteResponse {
  status: 'Ok' | 'Error';
  error: string | null;
  result: GardenQuoteItem[];
}

export interface GardenSwap {
  swap_id: string;
  chain: string;
  asset: string;
  amount: string;
  secret_hash: string;
  initiate_tx_hash: string | null;
  redeem_tx_hash: string | null;
  refund_tx_hash: string | null;
  required_confirmations: number;
  current_confirmations: number;
}

export interface GardenOrder {
  order_id: string;
  created_at: string;
  source_swap: GardenSwap;
  destination_swap: GardenSwap;
  nonce: string;
  version: string;
  solver_id: string;
}

export interface GardenOrderResponse {
  status: 'Ok' | 'Error';
  error: string | null;
  result: GardenOrder;
}

/** Response for Bitcoin source orders — deposit address + amount */
export interface GardenCreateOrderBtcResult {
  order_id: string;
  to: string;
  amount: number;
}

export interface GardenCreateOrderResponse {
  status: 'Ok' | 'Error';
  error: string | null;
  result: GardenCreateOrderBtcResult;
}

export interface GardenOrderSource {
  asset: string;
  owner: string;
  amount: string;
}

export class GardenApi {
  private appId: string;

  constructor(appId: string) {
    this.appId = appId;
  }

  private async request<T>(method: string, path: string, body?: object): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'garden-app-id': this.appId,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.status === 'Error') {
        const message = data.error || `Garden API error: ${response.status}`;
        throw new GardenApiError(message, response.status, data);
      }

      return data as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getQuote(from: string, to: string, fromAmount: string): Promise<GardenQuoteResponse> {
    return this.request<GardenQuoteResponse>('GET', `/quote?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&from_amount=${encodeURIComponent(fromAmount)}`);
  }

  async createOrder(source: GardenOrderSource, destination: GardenOrderSource): Promise<GardenCreateOrderResponse> {
    return this.request<GardenCreateOrderResponse>('POST', '/orders', { source, destination });
  }

  async getOrder(orderId: string): Promise<GardenOrderResponse> {
    return this.request<GardenOrderResponse>('GET', `/orders/${encodeURIComponent(orderId)}`);
  }
}
