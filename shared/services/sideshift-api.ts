/**
 * SideShift v2 REST API client.
 * @see https://docs.sideshift.ai/
 */

const BASE_URL = 'https://sideshift.ai/api/v2';
const REQUEST_TIMEOUT = 5_000;
const COINS_CACHE_TTL_MS = 5 * 60_000;

export class SideshiftApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: any
  ) {
    super(message);
    this.name = 'SideshiftApiError';
  }
}

export interface SideshiftCoin {
  coin: string;
  networks: string[];
  name: string;
  hasMemo?: boolean;
  /** Networks currently paused for deposits. Array of network ids, or `true` when a single-network coin is paused. */
  depositOffline?: string[] | boolean;
  /** Networks currently paused for settlement. Array of network ids, or `true` when a single-network coin is paused. */
  settleOffline?: string[] | boolean;
}

/** Interprets SideShift's `depositOffline` / `settleOffline` field for a given network. */
export function isNetworkOffline(offline: string[] | boolean | undefined, network: string): boolean {
  return Array.isArray(offline) ? offline.includes(network) : offline === true;
}

export interface SideshiftPairInfo {
  min: string | null;
  max: string | null;
  rate: string | null;
  depositCoin: string;
  settleCoin: string;
  depositNetwork: string;
  settleNetwork: string;
}

export interface SideshiftQuoteResponse {
  id: string;
  createdAt: string;
  depositCoin: string;
  settleCoin: string;
  depositNetwork: string;
  settleNetwork: string;
  expiresAt: string;
  depositAmount: string;
  settleAmount: string;
  rate: string;
}

export type SideshiftShiftStatus = 'waiting' | 'pending' | 'processing' | 'review' | 'settling' | 'settled' | 'refund' | 'refunding' | 'refunded' | 'expired' | 'multiple';

export interface SideshiftShiftResponse {
  id: string;
  createdAt: string;
  depositCoin: string;
  settleCoin: string;
  depositNetwork: string;
  settleNetwork: string;
  depositAddress: string;
  settleAddress: string;
  depositMin: string;
  depositMax: string;
  status: SideshiftShiftStatus;
  depositAmount: string | null;
  settleAmount: string | null;
  rate: string | null;
  quoteId: string | null;
  averageShiftSeconds: string;
}

export interface CreateQuoteParams {
  depositCoin: string;
  depositNetwork: string;
  settleCoin: string;
  settleNetwork: string;
  depositAmount: string;
}

export interface CreateFixedShiftParams {
  quoteId: string;
  settleAddress: string;
  affiliateId?: string;
}

export class SideshiftApi {
  private affiliateId?: string;
  private coinsCache?: { promise: Promise<SideshiftCoin[]>; fetchedAt: number };

  constructor(affiliateId?: string) {
    this.affiliateId = affiliateId;
  }

  getAffiliateId(): string | undefined {
    return this.affiliateId;
  }

  private async request<T>(method: string, path: string, body?: object): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
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

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw new SideshiftApiError('Rate limited. Please wait a moment and try again.', 429, errorBody);
        }
        throw new SideshiftApiError(errorBody.error?.message || `SideShift API error: ${response.status}`, response.status, errorBody);
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /** Cached for COINS_CACHE_TTL_MS. Concurrent callers share one in-flight request; failures are not cached. */
  async getCoins(): Promise<SideshiftCoin[]> {
    const now = Date.now();
    if (!this.coinsCache || now - this.coinsCache.fetchedAt >= COINS_CACHE_TTL_MS) {
      const promise = this.request<SideshiftCoin[]>('GET', '/coins').then((coins) => {
        if (!Array.isArray(coins)) throw new SideshiftApiError('Malformed /coins response', 200, coins);
        return coins;
      });
      this.coinsCache = { promise, fetchedAt: now };
      promise.catch(() => {
        if (this.coinsCache?.promise === promise) this.coinsCache = undefined;
      });
    }
    return this.coinsCache.promise;
  }

  async getPair(depositMethodId: string, settleMethodId: string): Promise<SideshiftPairInfo> {
    return this.request<SideshiftPairInfo>('GET', `/pair/${depositMethodId}/${settleMethodId}`);
  }

  async createQuote(params: CreateQuoteParams): Promise<SideshiftQuoteResponse> {
    return this.request<SideshiftQuoteResponse>('POST', '/quotes', params);
  }

  async createFixedShift(params: CreateFixedShiftParams): Promise<SideshiftShiftResponse> {
    const body: any = {
      quoteId: params.quoteId,
      settleAddress: params.settleAddress,
    };
    if (params.affiliateId || this.affiliateId) {
      body.affiliateId = params.affiliateId || this.affiliateId;
    }
    return this.request<SideshiftShiftResponse>('POST', '/shifts/fixed', body);
  }

  async getShift(shiftId: string): Promise<SideshiftShiftResponse> {
    return this.request<SideshiftShiftResponse>('GET', `/shifts/${shiftId}`);
  }
}
