import { describe, it, expect, vi } from 'vitest';
import { TransferServiceManager } from '../../services/transfer-service-manager';
import { ITransferService, TransferExecution, TransferNoRouteError, TransferPair, TransferQuote } from '../../types/transfer';

const BTC = 'native:bitcoin' as const;
const LBTC = 'native:liquid' as const;
const USDT = 'token:liquid:usdt' as const;

function makeQuote(receiveAmount: string, serviceName?: string): TransferQuote {
  return {
    id: `quote-${Math.random()}`,
    sendAsset: BTC,
    receiveAsset: LBTC,
    sendAmount: '0.01',
    receiveAmount,
    rate: '1 BTC ≈ 0.98 L-BTC',
    fee: '0',
    feeTicker: 'BTC',
    estimatedTime: 600,
    expiresAt: Math.floor(Date.now() / 1000) + 300,
    serviceName,
  };
}

function makeExecution(id: string, createdAt: number, serviceName: string = 'Test'): TransferExecution {
  return {
    id,
    status: 'pending',
    sendAmount: '0.01',
    receiveAmount: '0.0098',
    sendAsset: BTC,
    receiveAsset: LBTC,
    createdAt,
    accountNumber: 0,
    serviceName,
  };
}

function createMockService(name: string, _assets: string[], pairs: TransferPair[]): ITransferService {
  return {
    name,
    getSupportedPairs: vi.fn(() => pairs),
    getQuote: vi.fn(),
    executeTransfer: vi.fn(),
    getOngoingTransfers: vi.fn(async () => []),
    getTimelineSteps: vi.fn(() => []),
  };
}

describe('TransferServiceManager', () => {
  describe('getSupportedPairs', () => {
    it('unions pairs from multiple services', () => {
      const s1 = createMockService('A', [BTC, LBTC], [{ sendAssetId: BTC, receiveAssetId: LBTC }]);
      const s2 = createMockService('B', [BTC, USDT], [{ sendAssetId: BTC, receiveAssetId: USDT }]);
      const manager = new TransferServiceManager([s1, s2]);

      const pairs = manager.getSupportedPairs();
      expect(pairs).toHaveLength(2);
    });

    it('deduplicates identical pairs from different services', () => {
      const pair = { sendAssetId: BTC, receiveAssetId: LBTC };
      const s1 = createMockService('A', [BTC, LBTC], [pair]);
      const s2 = createMockService('B', [BTC, LBTC], [pair]);
      const manager = new TransferServiceManager([s1, s2]);

      const pairs = manager.getSupportedPairs();
      expect(pairs).toHaveLength(1);
    });
  });

  describe('getQuote', () => {
    it('delegates to single provider for a pair', async () => {
      const s1 = createMockService('A', [BTC, LBTC], [{ sendAssetId: BTC, receiveAssetId: LBTC }]);
      const quote = makeQuote('0.0098');
      vi.mocked(s1.getQuote).mockResolvedValue(quote);

      const manager = new TransferServiceManager([s1]);
      const result = await manager.getQuote(BTC, LBTC, '0.01');

      expect(result.receiveAmount).toBe('0.0098');
      expect(result.serviceName).toBe('A');
      expect(s1.getQuote).toHaveBeenCalledWith(BTC, LBTC, '0.01');
    });

    it('picks best rate when two providers support same pair', async () => {
      const pair = { sendAssetId: BTC, receiveAssetId: LBTC };
      const s1 = createMockService('Cheap', [BTC, LBTC], [pair]);
      const s2 = createMockService('Better', [BTC, LBTC], [pair]);

      vi.mocked(s1.getQuote).mockResolvedValue(makeQuote('0.0095'));
      vi.mocked(s2.getQuote).mockResolvedValue(makeQuote('0.0098'));

      const manager = new TransferServiceManager([s1, s2]);
      const result = await manager.getQuote(BTC, LBTC, '0.01');

      expect(result.receiveAmount).toBe('0.0098');
      expect(result.serviceName).toBe('Better');
    });

    it('uses surviving provider when one fails', async () => {
      const pair = { sendAssetId: BTC, receiveAssetId: LBTC };
      const s1 = createMockService('Broken', [BTC, LBTC], [pair]);
      const s2 = createMockService('Working', [BTC, LBTC], [pair]);

      vi.mocked(s1.getQuote).mockRejectedValue(new Error('API down'));
      vi.mocked(s2.getQuote).mockResolvedValue(makeQuote('0.0097'));

      const manager = new TransferServiceManager([s1, s2]);
      const result = await manager.getQuote(BTC, LBTC, '0.01');

      expect(result.receiveAmount).toBe('0.0097');
      expect(result.serviceName).toBe('Working');
    });

    it('attaches serviceErrors on partial failure', async () => {
      const pair = { sendAssetId: BTC, receiveAssetId: LBTC };
      const s1 = createMockService('SideShift', [BTC, LBTC], [pair]);
      const s2 = createMockService('Symbiosis', [BTC, LBTC], [pair]);

      vi.mocked(s1.getQuote).mockRejectedValue(Object.assign(new Error('Access denied'), { statusCode: 403 }));
      vi.mocked(s2.getQuote).mockResolvedValue(makeQuote('0.0097'));

      const manager = new TransferServiceManager([s1, s2]);
      const result = await manager.getQuote(BTC, LBTC, '0.01');

      expect(result.receiveAmount).toBe('0.0097');
      expect(result.serviceErrors).toHaveLength(1);
      expect(result.serviceErrors![0].service).toBe('SideShift');
      expect(result.serviceErrors![0].message).toBe('access denied');
    });

    it('throws with serviceErrors when all providers fail', async () => {
      const pair = { sendAssetId: BTC, receiveAssetId: LBTC };
      const s1 = createMockService('A', [BTC, LBTC], [pair]);
      const s2 = createMockService('B', [BTC, LBTC], [pair]);

      vi.mocked(s1.getQuote).mockRejectedValue(Object.assign(new Error('Access denied'), { statusCode: 403 }));
      vi.mocked(s2.getQuote).mockRejectedValue(new Error('rate limited'));

      const manager = new TransferServiceManager([s1, s2]);
      try {
        await manager.getQuote(BTC, LBTC, '0.01');
        expect.unreachable('should have thrown');
      } catch (e: any) {
        expect(e).toBeInstanceOf(TransferNoRouteError);
        expect(e.serviceErrors).toHaveLength(2);
        expect(e.serviceErrors[0]).toEqual({ service: 'A', message: 'access denied' });
        expect(e.serviceErrors[1]).toEqual({ service: 'B', message: 'rate limited' });
      }
    });

    it('throws when no provider supports the pair', async () => {
      const s1 = createMockService('A', [BTC, LBTC], [{ sendAssetId: BTC, receiveAssetId: LBTC }]);
      const manager = new TransferServiceManager([s1]);

      await expect(manager.getQuote(BTC, USDT, '0.01')).rejects.toThrow(TransferNoRouteError);
    });
  });

  describe('executeTransfer', () => {
    it('routes to correct service via quote.serviceName', async () => {
      const s1 = createMockService('A', [BTC, LBTC], []);
      const s2 = createMockService('B', [BTC, LBTC], []);
      const exec = makeExecution('exec-1', Date.now() / 1000);
      vi.mocked(s2.executeTransfer).mockResolvedValue(exec);

      const manager = new TransferServiceManager([s1, s2]);
      const quote = makeQuote('0.0098', 'B');
      const result = await manager.executeTransfer(quote, 'addr123');

      expect(s2.executeTransfer).toHaveBeenCalledWith(quote, 'addr123', undefined);
      expect(s1.executeTransfer).not.toHaveBeenCalled();
      expect(result.serviceName).toBe('B');
    });

    it('throws when serviceName is missing', async () => {
      const s1 = createMockService('A', [BTC, LBTC], []);
      const manager = new TransferServiceManager([s1]);
      const quote = makeQuote('0.0098'); // no serviceName

      await expect(manager.executeTransfer(quote, 'addr123')).rejects.toThrow('Missing serviceName');
    });
  });

  describe('getOngoingTransfers', () => {
    it('aggregates from all services sorted by createdAt desc', async () => {
      const s1 = createMockService('A', [], []);
      const s2 = createMockService('B', [], []);
      vi.mocked(s1.getOngoingTransfers).mockResolvedValue([makeExecution('e1', 100)]);
      vi.mocked(s2.getOngoingTransfers).mockResolvedValue([makeExecution('e2', 200)]);

      const manager = new TransferServiceManager([s1, s2]);
      const result = await manager.getOngoingTransfers(0);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('e2'); // newer first
      expect(result[1].id).toBe('e1');
      expect(result[0].serviceName).toBe('Test');
      expect(result[1].serviceName).toBe('Test');
    });

    it('returns other services transfers when one fails', async () => {
      const s1 = createMockService('A', [], []);
      const s2 = createMockService('B', [], []);
      vi.mocked(s1.getOngoingTransfers).mockRejectedValue(new Error('storage error'));
      vi.mocked(s2.getOngoingTransfers).mockResolvedValue([makeExecution('e2', 200)]);

      const manager = new TransferServiceManager([s1, s2]);
      const result = await manager.getOngoingTransfers(0);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('e2');
    });
  });

  describe('getTrackingUrl', () => {
    it('delegates to correct service by serviceName', () => {
      const s1 = createMockService('A', [], []);
      s1.getTrackingUrl = vi.fn(() => 'https://example.com/track/123');
      const manager = new TransferServiceManager([s1]);

      const url = manager.getTrackingUrl(makeExecution('e1', 100, 'A'));
      expect(url).toBe('https://example.com/track/123');
    });

    it('returns undefined when service has no getTrackingUrl', () => {
      const s1 = createMockService('A', [], []);
      const manager = new TransferServiceManager([s1]);

      const url = manager.getTrackingUrl(makeExecution('e1', 100, 'A'));
      expect(url).toBeUndefined();
    });

    it('returns undefined when serviceName is missing', () => {
      const s1 = createMockService('A', [], []);
      const manager = new TransferServiceManager([s1]);

      const url = manager.getTrackingUrl(makeExecution('e1', 100));
      expect(url).toBeUndefined();
    });
  });
});
