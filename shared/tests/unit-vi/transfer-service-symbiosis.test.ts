import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SymbiosisTransferService, mapSymbiosisStatus } from '../../services/transfer-service-symbiosis';
import { DepositAddressExecution, EXECUTION_DEPOSIT } from '../../types/transfer';

const mockStorage = {
  getItem: vi.fn().mockResolvedValue(''),
  setItem: vi.fn().mockResolvedValue(undefined),
};

const SEND = 'native:bitcoin' as const;
const RECEIVE = 'native:rootstock' as const;

function makeExecution(overrides: Partial<DepositAddressExecution> = {}): DepositAddressExecution {
  return {
    type: EXECUTION_DEPOSIT,
    id: 'e1',
    status: 'pending',
    sendAmount: '0.01',
    receiveAmount: '0.0099',
    sendAsset: SEND,
    receiveAsset: RECEIVE,
    createdAt: 0,
    updatedAt: 0,
    accountNumber: 0,
    serviceName: 'Symbiosis',
    ...overrides,
  };
}

function makeSwapResponse(overrides?: Partial<any>) {
  return {
    kind: 'from-btc-swap',
    type: 'btc',
    tokenAmountOut: { amount: '9906408750902318', decimals: 18 },
    estimatedTime: 48,
    fee: { symbol: 'BTC', amount: '400', decimals: 8 },
    fees: [],
    tx: {
      depositAddress: 'bc1pexample',
      expiresAt: '2026-03-07T14:47:49.786Z',
    },
    ...overrides,
  };
}

describe('SymbiosisTransferService', () => {
  let service: SymbiosisTransferService;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SymbiosisTransferService(mockStorage);
    fetchSpy = vi.fn();
    global.fetch = fetchSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSupportedPairs', () => {
    it('returns BTC→Rootstock and BTC→Citrea pairs', () => {
      const pairs = service.getSupportedPairs();
      expect(pairs).toEqual([
        { sendAssetId: 'native:bitcoin', receiveAssetId: 'native:rootstock' },
        { sendAssetId: 'native:bitcoin', receiveAssetId: 'native:citrea' },
      ]);
    });
  });

  describe('getQuote', () => {
    it('returns quote with correct amounts from API response', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makeSwapResponse()),
      });

      const quote = await service.getQuote(SEND, RECEIVE, '0.01');

      expect(quote.sendAsset).toBe(SEND);
      expect(quote.receiveAsset).toBe(RECEIVE);
      expect(quote.sendAmount).toBe('0.01');
      // 9906408750902318 / 1e18 = 0.009906408750902318
      expect(parseFloat(quote.receiveAmount)).toBeCloseTo(0.0099064, 5);
      // fee: 400 / 1e8 = 0.000004
      expect(quote.fee).toBe('0.00000400');
      expect(quote.feeTicker).toBe('BTC');
      expect(quote.estimatedTime).toBe(48);
      expect(quote.rate).toContain('BTC');
      expect(quote.rate).toContain('RBTC');
    });

    it('throws on unsupported receive network', async () => {
      await expect(service.getQuote(SEND, 'native:spark', '0.01')).rejects.toThrow('Unsupported receive network');
    });

    it('throws on API error', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'No route found' }),
      });

      await expect(service.getQuote(SEND, RECEIVE, '0.01')).rejects.toThrow('No route found');
    });
  });

  describe('executeTransfer', () => {
    it('creates execution with deposit address', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makeSwapResponse()),
      });

      const quote = {
        id: 'test-quote',
        sendAsset: SEND,
        receiveAsset: RECEIVE,
        sendAmount: '0.01',
        receiveAmount: '0.0099',
        rate: '1:1',
        fee: '0',
        feeTicker: 'BTC',
        estimatedTime: 48,
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        serviceName: 'Test',
      };

      const execution = await service.executeTransfer(quote, 0, '0xSettleAddr', 'bc1qRefundAddr');

      expect(execution.status).toBe('waiting');
      expect(execution.depositAddress).toBe('bc1pexample');
      expect(execution.settleAddress).toBe('0xSettleAddr');
      expect(execution.sendAmount).toBe('0.01');
      expect(execution.sendAsset).toBe(SEND);
      expect(execution.receiveAsset).toBe(RECEIVE);
    });

    it('throws when API returns non-BTC swap type', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makeSwapResponse({ type: 'evm', tx: { data: '0x', to: '0x1', value: '0' } })),
      });

      const quote = {
        id: 'test-quote',
        sendAsset: SEND,
        receiveAsset: RECEIVE,
        sendAmount: '0.01',
        receiveAmount: '0.0099',
        rate: '1:1',
        fee: '0',
        feeTicker: 'BTC',
        estimatedTime: 48,
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        serviceName: 'Test',
      };

      await expect(service.executeTransfer(quote, 0, '0xAddr')).rejects.toThrow('unsupported swap type');
    });
  });

  describe('commitTransfer', () => {
    it('persists transfer to storage', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makeSwapResponse()),
      });

      const quote = {
        id: 'test-quote',
        sendAsset: SEND,
        receiveAsset: RECEIVE,
        sendAmount: '0.01',
        receiveAmount: '0.0099',
        rate: '1:1',
        fee: '0',
        feeTicker: 'BTC',
        estimatedTime: 48,
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        serviceName: 'Test',
      };

      const execution = await service.executeTransfer(quote, 0, '0xAddr');
      await service.commitTransfer({ ...execution, depositTxid: 'abc123' });

      expect(mockStorage.setItem).toHaveBeenCalled();
      const saved = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
      expect(saved).toHaveLength(1);
      expect(saved[0].execution.depositTxid).toEqual('abc123');
    });
  });

  describe('getOngoingTransfers', () => {
    it('returns empty for no stored transfers', async () => {
      const transfers = await service.getOngoingTransfers(0);
      expect(transfers).toEqual([]);
    });

    it('polls status for transfers with txHash', async () => {
      const stored = [
        {
          execution: {
            type: EXECUTION_DEPOSIT,
            id: 'sym-1',
            status: 'waiting',
            sendAmount: '0.01',
            receiveAmount: '0.0099',
            sendAsset: SEND,
            receiveAsset: RECEIVE,
            createdAt: Math.floor(Date.now() / 1000),
            updatedAt: 0,
            depositTxid: 'txhash123',
            accountNumber: 0,
            serviceName: 'Symbiosis',
          },
        },
      ];
      mockStorage.getItem.mockResolvedValueOnce(JSON.stringify(stored));

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: { code: 1, text: 'Pending' } }),
      });

      const transfers = await service.getOngoingTransfers(0);
      expect(transfers).toHaveLength(1);
      expect(transfers[0].status).toBe('pending');
    });

    it('does not poll transfers without txHash', async () => {
      const stored = [
        {
          execution: {
            type: EXECUTION_DEPOSIT,
            id: 'sym-2',
            status: 'waiting',
            sendAmount: '0.01',
            receiveAmount: '0.0099',
            sendAsset: SEND,
            receiveAsset: RECEIVE,
            createdAt: Math.floor(Date.now() / 1000),
            updatedAt: 0,
            accountNumber: 0,
            serviceName: 'Symbiosis',
          },
        },
      ];
      mockStorage.getItem.mockResolvedValueOnce(JSON.stringify(stored));

      const transfers = await service.getOngoingTransfers(0);
      expect(transfers).toHaveLength(1);
      expect(transfers[0].status).toBe('waiting');
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('getTrackingUrl', () => {
    it('returns Symbiosis explorer URL when depositTxid has txHash', () => {
      const url = service.getTrackingUrl(makeExecution({ depositTxid: 'abc123def' }));
      expect(url).toBe('https://explorer.symbiosis.finance/transactions/3652501241/abc123def');
    });

    it('returns undefined when no depositTxid', () => {
      const url = service.getTrackingUrl(makeExecution());
      expect(url).toBeUndefined();
    });

    it('returns undefined when depositTxid is empty', () => {
      const url = service.getTrackingUrl(makeExecution({ depositTxid: '' }));
      expect(url).toBeUndefined();
    });
  });

  describe('mapSymbiosisStatus', () => {
    it('maps status codes correctly', () => {
      expect(mapSymbiosisStatus(0, 'Success')).toBe('completed');
      expect(mapSymbiosisStatus(1, 'Pending')).toBe('pending');
      expect(mapSymbiosisStatus(2, 'Stuck')).toBe('pending');
      expect(mapSymbiosisStatus(3, 'Reverted')).toBe('failed');
      expect(mapSymbiosisStatus(-1, 'Not found')).toBe('waiting');
      expect(mapSymbiosisStatus(999)).toBe('waiting');
    });

    it('maps Reverted text to failed', () => {
      expect(mapSymbiosisStatus(0, 'Reverted')).toBe('failed');
    });

    it('maps Stale text to failed', () => {
      expect(mapSymbiosisStatus(0, 'Stale')).toBe('failed');
    });
  });

  describe('deposit expiration', () => {
    it('marks transfer as expired when deposit window passes without BTC sent', async () => {
      const pastExpiry = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const stored = [
        {
          execution: {
            type: EXECUTION_DEPOSIT,
            id: 'sym-exp',
            status: 'waiting',
            sendAmount: '0.01',
            receiveAmount: '0.0099',
            sendAsset: SEND,
            receiveAsset: RECEIVE,
            createdAt: pastExpiry - 600,
            updatedAt: 0,
            accountNumber: 0,
            serviceName: 'Symbiosis',
          },
          expiresAt: pastExpiry,
        },
      ];
      mockStorage.getItem.mockResolvedValueOnce(JSON.stringify(stored));

      const transfers = await service.getOngoingTransfers(0);
      expect(transfers).toHaveLength(1);
      expect(transfers[0].status).toBe('expired');
    });

    it('does not expire transfer when deposit window is still open', async () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const stored = [
        {
          execution: {
            type: EXECUTION_DEPOSIT,
            id: 'sym-notexp',
            status: 'waiting',
            sendAmount: '0.01',
            receiveAmount: '0.0099',
            sendAsset: SEND,
            receiveAsset: RECEIVE,
            createdAt: Math.floor(Date.now() / 1000),
            updatedAt: 0,
            accountNumber: 0,
            serviceName: 'Symbiosis',
          },
          expiresAt: futureExpiry,
        },
      ];
      mockStorage.getItem.mockResolvedValueOnce(JSON.stringify(stored));

      const transfers = await service.getOngoingTransfers(0);
      expect(transfers).toHaveLength(1);
      expect(transfers[0].status).toBe('waiting');
    });
  });
});
