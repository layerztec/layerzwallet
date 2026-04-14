import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mapSatoraStatus, SatoraTransferService, shouldTriggerClaim } from '../../services/transfer-service-satora';
import type { TransferQuote } from '../../types/transfer';

const mockGetQuote = vi.fn();
const mockCreateSwap = vi.fn();
const mockGetSwap = vi.fn();
const mockClaim = vi.fn();
const mockFundSwapGasless = vi.fn();
const mockClaimArkade = vi.fn();

vi.mock('@lendasat/lendaswap-sdk-pure', () => {
  class FakeClientBuilder {
    withSignerStorage() {
      return this;
    }
    withSwapStorage() {
      return this;
    }
    withBaseUrl() {
      return this;
    }
    withApiKey() {
      return this;
    }
    async build() {
      return {
        getQuote: mockGetQuote,
        createSwap: mockCreateSwap,
        getSwap: mockGetSwap,
        claim: mockClaim,
        fundSwapGasless: mockFundSwapGasless,
        claimArkade: mockClaimArkade,
      };
    }
  }
  return {
    Client: { builder: () => new FakeClientBuilder() },
  };
});

function makeStorage() {
  const store: Record<string, string> = {};
  return {
    _store: store,
    setItem: vi.fn(async (k: string, v: string) => {
      store[k] = v;
    }),
    getItem: vi.fn(async (k: string) => store[k] || ''),
  };
}

const ROOTSTOCK_ADDRESS = '0x1234567890abcdefABCDEF1234567890abcdefAB';
const USDT0_ROOTSTOCK_ADDR = '0x779dED0C9e1022225F8e0630b35A9B54Be713736';

// 0.0001 BTC → 10_000 sats. SDK quote returns target_amount in USDT0 smallest units
// (6 decimals). 1 BTC ≈ 100k USDT0 → 10k sats → ~10 USDT0 = 10_000_000 smallest units.
const QUOTE_RESPONSE = {
  exchange_rate: '100000',
  network_fee: 100,
  gasless_network_fee: 50,
  protocol_fee: 25,
  protocol_fee_rate: 0.0025,
  min_amount: 1000,
  max_amount: 100_000_000,
  source_amount: '10000',
  target_amount: '10000000',
  // bridge_fee intentionally omitted — should be handled as undefined
};

const CREATE_SWAP_RESPONSE = {
  id: 'swap-abc',
  status: 'pending' as const,
  bolt11_invoice: 'lnbc100u1pxxxxxxexample',
  boltz_invoice: 'lnbc100u1pxxxxxxexample', // deprecated alias
  boltz_swap_id: 'boltz-123',
  bridge_target_chain: 'Rootstock',
  bridge_target_token_address: USDT0_ROOTSTOCK_ADDR,
  client_evm_address: '0xCAFE0000000000000000000000000000DEADBEEF',
  evm_coordinator_address: '0xCOORD',
  evm_chain_id: 42161, // Arbitrum internally (SDK remaps Rootstock to Arb + bridge)
  evm_htlc_address: '0xHTLC',
  evm_expected_sats: '10000',
  evm_refund_locktime: 0,
  fee_sats: 175,
  hash_lock: '0x',
  network: 'arbitrum',
  receiver_pk: '',
  sender_pk: '',
  server_evm_address: '0xSRV',
  arkade_server_pk: '',
  chain: 'Arbitrum',
  created_at: '2026-04-14T00:00:00Z',
  source_amount: '10000',
  target_amount: '10000000',
  source_token: { symbol: 'BTC', decimals: 8, name: 'Bitcoin', token_id: 'btc', chain: 'Lightning' },
  target_token: { symbol: 'USDT0', decimals: 6, name: 'USDT0', token_id: USDT0_ROOTSTOCK_ADDR, chain: 'Arbitrum' },
  unilateral_claim_delay: 0,
  unilateral_refund_delay: 0,
  unilateral_refund_without_receiver_delay: 0,
  vhtlc_refund_locktime: 0,
};

describe('SatoraTransferService', () => {
  let service: SatoraTransferService;
  let storage: ReturnType<typeof makeStorage>;

  beforeEach(() => {
    mockGetQuote.mockReset();
    mockCreateSwap.mockReset();
    mockGetSwap.mockReset();
    mockClaim.mockReset();
    mockFundSwapGasless.mockReset();
    mockClaimArkade.mockReset();
    storage = makeStorage();
    service = new SatoraTransferService(storage);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getSupportedPairs', () => {
    it('returns exactly one pair: native:lightning → token:rootstock:usdt0', () => {
      const pairs = service.getSupportedPairs();
      expect(pairs).toEqual([{ sendAssetId: 'native:lightning', receiveAssetId: 'token:rootstock:usdt0' }]);
    });
  });

  describe('getQuote', () => {
    it('calls the SDK with sourceChain=Lightning, targetChain=30, and USDT0 address', async () => {
      mockGetQuote.mockResolvedValue(QUOTE_RESPONSE);

      const q = await service.getQuote('native:lightning', 'token:rootstock:usdt0', '0.0001');

      expect(mockGetQuote).toHaveBeenCalledTimes(1);
      const args = mockGetQuote.mock.calls[0][0];
      expect(args.sourceChain).toBe('Lightning');
      expect(args.sourceToken).toBe('btc');
      expect(args.targetChain).toBe('30');
      expect(args.targetToken).toBe(USDT0_ROOTSTOCK_ADDR);
      expect(args.sourceAmount).toBe(10_000); // 0.0001 BTC * 1e8

      expect(q.serviceName).toBe('Satora');
      expect(q.sendAsset).toBe('native:lightning');
      expect(q.receiveAsset).toBe('token:rootstock:usdt0');
      expect(q.sendAmount).toBe('0.0001');
      expect(q.receiveAmount).toBe('10.000000'); // 10_000_000 / 1e6
      expect(q.feeTicker).toBe('BTC');
      // Total fee = protocol + network + gasless = 175 sats → 0.00000175 BTC
      expect(q.fee).toBe('0.00000175');
      expect(q.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(q.rate).toContain('USDT0');
    });

    it('handles missing bridge_fee gracefully', async () => {
      mockGetQuote.mockResolvedValue(QUOTE_RESPONSE); // no bridge_fee field

      const q = await service.getQuote('native:lightning', 'token:rootstock:usdt0', '0.0001');
      expect(q.fee).toBe('0.00000175'); // unchanged — bridge_fee handled as undefined
    });

    it('rejects unsupported send assets', async () => {
      await expect(service.getQuote('native:bitcoin' as any, 'token:rootstock:usdt0', '0.0001')).rejects.toThrow();
    });

    it('rejects unsupported receive assets', async () => {
      await expect(service.getQuote('native:lightning', 'native:bitcoin' as any, '0.0001')).rejects.toThrow();
    });

    it('rejects non-positive amounts', async () => {
      await expect(service.getQuote('native:lightning', 'token:rootstock:usdt0', '0')).rejects.toThrow();
    });
  });

  describe('executeTransfer', () => {
    it('creates a gasless swap and returns a deposit-address execution with the BOLT11 invoice', async () => {
      mockGetQuote.mockResolvedValue(QUOTE_RESPONSE);
      mockCreateSwap.mockResolvedValue({ response: CREATE_SWAP_RESPONSE });

      const quote = await service.getQuote('native:lightning', 'token:rootstock:usdt0', '0.0001');
      const exec = await service.executeTransfer(quote, 0, ROOTSTOCK_ADDRESS);

      expect(mockCreateSwap).toHaveBeenCalledTimes(1);
      const createArgs = mockCreateSwap.mock.calls[0][0];
      expect(createArgs.gasless).toBe(true);
      expect(createArgs.source).toEqual({ chain: 'Lightning', tokenId: 'btc' });
      expect(createArgs.target).toEqual({ chain: '30', tokenId: USDT0_ROOTSTOCK_ADDR });
      expect(createArgs.targetAddress).toBe(ROOTSTOCK_ADDRESS);
      expect(createArgs.sourceAmount).toBe(10_000);

      expect(exec.id).toBe('swap-abc');
      expect(exec.providerId).toBe('swap-abc');
      expect(exec.depositAddress).toBe('lnbc100u1pxxxxxxexample'); // the BOLT11 to pay
      expect(exec.settleAddress).toBe(ROOTSTOCK_ADDRESS);
      expect(exec.status).toBe('waiting');
      expect(exec.serviceName).toBe('Satora');
      expect(exec.accountNumber).toBe(0);
    });

    it('rejects a non-0x settleAddress', async () => {
      mockGetQuote.mockResolvedValue(QUOTE_RESPONSE);
      mockCreateSwap.mockResolvedValue({ response: CREATE_SWAP_RESPONSE });
      const quote = await service.getQuote('native:lightning', 'token:rootstock:usdt0', '0.0001');
      await expect(service.executeTransfer(quote, 0, 'not-a-rootstock-address')).rejects.toThrow(/Rootstock/i);
    });

    it('rejects expired quotes', async () => {
      const expired: TransferQuote = {
        id: 'q1',
        serviceName: 'Satora',
        sendAsset: 'native:lightning',
        receiveAsset: 'token:rootstock:usdt0',
        sendAmount: '0.0001',
        receiveAmount: '10',
        rate: '1 BTC = 100000 USDT0',
        fee: '0',
        feeTicker: 'BTC',
        estimatedTime: 300,
        expiresAt: Math.floor(Date.now() / 1000) - 10,
      };
      await expect(service.executeTransfer(expired, 0, ROOTSTOCK_ADDRESS)).rejects.toThrow(/expired/i);
    });
  });

  describe('mapSatoraStatus', () => {
    it('maps every documented status to the expected TransferStatus', () => {
      expect(mapSatoraStatus('pending')).toBe('waiting');
      expect(mapSatoraStatus('clientfundingseen')).toBe('confirming');
      expect(mapSatoraStatus('clientfunded')).toBe('pending');
      expect(mapSatoraStatus('serverfunded')).toBe('pending');
      expect(mapSatoraStatus('clientredeeming')).toBe('pending');
      expect(mapSatoraStatus('clientredeemed')).toBe('completed');
      expect(mapSatoraStatus('serverredeemed')).toBe('completed');
      expect(mapSatoraStatus('clientrefunded')).toBe('refunded');
      expect(mapSatoraStatus('clientfundedserverrefunded')).toBe('refunded');
      expect(mapSatoraStatus('expired')).toBe('expired');
      expect(mapSatoraStatus('clientfundedtoolate')).toBe('expired');
      expect(mapSatoraStatus('clientinvalidfunded')).toBe('failed');
    });
  });

  describe('shouldTriggerClaim', () => {
    it('only fires on serverfunded', () => {
      expect(shouldTriggerClaim('serverfunded')).toBe(true);
      expect(shouldTriggerClaim('pending')).toBe(false);
      expect(shouldTriggerClaim('clientfundingseen')).toBe(false);
      expect(shouldTriggerClaim('clientfunded')).toBe(false);
      expect(shouldTriggerClaim('clientredeeming')).toBe(false);
      expect(shouldTriggerClaim('clientredeemed')).toBe(false);
    });
  });

  describe('getOngoingTransfers + auto-claim', () => {
    async function setupCommittedSwap() {
      mockGetQuote.mockResolvedValue(QUOTE_RESPONSE);
      mockCreateSwap.mockResolvedValue({ response: CREATE_SWAP_RESPONSE });
      const quote = await service.getQuote('native:lightning', 'token:rootstock:usdt0', '0.0001');
      const exec = await service.executeTransfer(quote, 0, ROOTSTOCK_ADDRESS);
      await service.commitTransfer(exec);
    }

    it('drives the full lifecycle and fires client.claim exactly once on serverfunded', async () => {
      await setupCommittedSwap();

      // Poll 1: pending → no claim.
      mockGetSwap.mockResolvedValueOnce({ ...CREATE_SWAP_RESPONSE, status: 'pending' });
      let active = await service.getOngoingTransfers(0);
      expect(mockClaim).not.toHaveBeenCalled();
      expect(active[0].status).toBe('waiting');

      // Poll 2: clientfundingseen → still no claim.
      mockGetSwap.mockResolvedValueOnce({ ...CREATE_SWAP_RESPONSE, status: 'clientfundingseen' });
      active = await service.getOngoingTransfers(0);
      expect(mockClaim).not.toHaveBeenCalled();
      expect(active[0].status).toBe('confirming');

      // Poll 3: clientfunded → still no claim.
      mockGetSwap.mockResolvedValueOnce({ ...CREATE_SWAP_RESPONSE, status: 'clientfunded' });
      active = await service.getOngoingTransfers(0);
      expect(mockClaim).not.toHaveBeenCalled();
      expect(active[0].status).toBe('pending');

      // Poll 4: serverfunded → claim fires.
      mockGetSwap.mockResolvedValueOnce({ ...CREATE_SWAP_RESPONSE, status: 'serverfunded' });
      mockClaim.mockResolvedValueOnce({ success: true, message: 'ok', txHash: '0xredeem' });
      active = await service.getOngoingTransfers(0);
      expect(mockClaim).toHaveBeenCalledTimes(1);
      expect(mockClaim).toHaveBeenCalledWith('swap-abc');
      expect(active[0].status).toBe('pending');

      // Poll 5: clientredeeming → claim must NOT fire again (flag flipped true).
      mockGetSwap.mockResolvedValueOnce({ ...CREATE_SWAP_RESPONSE, status: 'clientredeeming' });
      active = await service.getOngoingTransfers(0);
      expect(mockClaim).toHaveBeenCalledTimes(1);
      expect(active[0].status).toBe('pending');

      // Poll 6: clientredeemed → terminal completed, claim never fired again.
      mockGetSwap.mockResolvedValueOnce({ ...CREATE_SWAP_RESPONSE, status: 'clientredeemed' });
      active = await service.getOngoingTransfers(0);
      expect(mockClaim).toHaveBeenCalledTimes(1);
      expect(active[0].status).toBe('completed');

      // Neither fundSwapGasless nor claimArkade should have been touched.
      expect(mockFundSwapGasless).not.toHaveBeenCalled();
      expect(mockClaimArkade).not.toHaveBeenCalled();
    });

    it('retries client.claim on the next poll when it reports success: false', async () => {
      await setupCommittedSwap();

      // First serverfunded poll: claim returns failure.
      mockGetSwap.mockResolvedValueOnce({ ...CREATE_SWAP_RESPONSE, status: 'serverfunded' });
      mockClaim.mockResolvedValueOnce({ success: false, message: 'temporary glitch' });
      await service.getOngoingTransfers(0);
      expect(mockClaim).toHaveBeenCalledTimes(1);

      // Second serverfunded poll: retry succeeds.
      mockGetSwap.mockResolvedValueOnce({ ...CREATE_SWAP_RESPONSE, status: 'serverfunded' });
      mockClaim.mockResolvedValueOnce({ success: true, message: 'ok', txHash: '0xredeem' });
      await service.getOngoingTransfers(0);
      expect(mockClaim).toHaveBeenCalledTimes(2);
    });

    it('retries client.claim on the next poll when it throws', async () => {
      await setupCommittedSwap();

      mockGetSwap.mockResolvedValueOnce({ ...CREATE_SWAP_RESPONSE, status: 'serverfunded' });
      mockClaim.mockRejectedValueOnce(new Error('network down'));
      await service.getOngoingTransfers(0);
      expect(mockClaim).toHaveBeenCalledTimes(1);

      mockGetSwap.mockResolvedValueOnce({ ...CREATE_SWAP_RESPONSE, status: 'serverfunded' });
      mockClaim.mockResolvedValueOnce({ success: true, message: 'ok', txHash: '0xredeem' });
      await service.getOngoingTransfers(0);
      expect(mockClaim).toHaveBeenCalledTimes(2);
    });

    it('filters by accountNumber', async () => {
      await setupCommittedSwap();
      mockGetSwap.mockResolvedValue({ ...CREATE_SWAP_RESPONSE, status: 'pending' });
      const acct0 = await service.getOngoingTransfers(0);
      const acct1 = await service.getOngoingTransfers(1);
      expect(acct0).toHaveLength(1);
      expect(acct1).toHaveLength(0);
    });
  });

  describe('storage round-trip', () => {
    it('preserves rootstockTargetAddress across service instances', async () => {
      mockGetQuote.mockResolvedValue(QUOTE_RESPONSE);
      mockCreateSwap.mockResolvedValue({ response: CREATE_SWAP_RESPONSE });
      const quote = await service.getQuote('native:lightning', 'token:rootstock:usdt0', '0.0001');
      const exec = await service.executeTransfer(quote, 0, ROOTSTOCK_ADDRESS);
      await service.commitTransfer(exec);

      // New instance, same storage — the persisted transfer should be readable.
      const service2 = new SatoraTransferService(storage);
      mockGetSwap.mockResolvedValueOnce({ ...CREATE_SWAP_RESPONSE, status: 'pending' });
      const transfers = await service2.getOngoingTransfers(0);
      expect(transfers).toHaveLength(1);
      expect(transfers[0].id).toBe('swap-abc');
      expect(transfers[0].settleAddress).toBe(ROOTSTOCK_ADDRESS);
      expect(transfers[0].depositAddress).toBe('lnbc100u1pxxxxxxexample');
    });
  });
});
