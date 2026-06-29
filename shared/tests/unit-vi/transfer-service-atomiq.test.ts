import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ecc from '@bitcoinerlab/secp256k1';

import { HDSegwitBech32Wallet } from '../../class/wallets/hd-segwit-bech32-wallet';
import { setMasterSeed } from '../../modules/wallet-utils';
import { AtomiqTransferService, mapSpvState } from '../../services/transfer-service-atomiq';
import { EXECUTION_INSTANT, TransferQuote } from '../../types/transfer';

const ECPair = ECPairFactory(ecc);

// Shared, controllable fakes for the Atomiq SDK. Hoisted so the vi.mock factories below can close over them.
const { fakeSwapper, fakeSwap } = vi.hoisted(() => {
  const fakeSwap = {
    getId: () => 'swap-1',
    getOutput: () => ({ amount: '0.00099' }),
    getFee: () => ({ amountInSrcToken: { amount: '0.00001' } }),
    getQuoteExpiry: () => Date.now() + 60_000,
    sendBitcoinTransaction: vi.fn().mockResolvedValue('btctxid-abc'),
    getState: () => 'BTC_TX_CONFIRMED',
    getInputTxId: () => 'btctxid-abc',
    isClaimable: () => false,
  };
  const fakeSwapper = {
    init: vi.fn().mockResolvedValue(undefined),
    swap: vi.fn().mockResolvedValue(fakeSwap),
    getSwapById: vi.fn().mockResolvedValue(undefined),
  };
  return { fakeSwapper, fakeSwap };
});

vi.mock('@atomiqlabs/chain-evm', () => ({
  CitreaInitializer: { chainId: 'CITREA' },
  EVMSigner: class {
    constructor(
      public account: unknown,
      public address: string
    ) {}
  },
}));

vi.mock('@atomiqlabs/sdk', () => ({
  SwapperFactory: class {
    Tokens = { BITCOIN: { BTC: { ticker: 'BTC' } }, CITREA: { CBTC: { ticker: 'CBTC' } } };
    newSwapper = () => fakeSwapper;
  },
  BitcoinNetwork: { MAINNET: 'MAINNET' },
  SwapAmountType: { EXACT_IN: 0 },
  SpvFromBTCSwap: class {},
  SpvFromBTCSwapState: {
    CLAIMED: 'CLAIMED',
    FRONTED: 'FRONTED',
    BTC_TX_CONFIRMED: 'BTC_TX_CONFIRMED',
    POSTED: 'POSTED',
    BROADCASTED: 'BROADCASTED',
    CREATED: 'CREATED',
    SIGNED: 'SIGNED',
    QUOTE_SOFT_EXPIRED: 'QUOTE_SOFT_EXPIRED',
    QUOTE_EXPIRED: 'QUOTE_EXPIRED',
    CLOSED: 'CLOSED',
    FAILED: 'FAILED',
    DECLINED: 'DECLINED',
  },
}));

const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const SEND = 'native:bitcoin' as const;
const RECEIVE = 'native:citrea' as const;

const mockStorage = {
  getItem: vi.fn().mockResolvedValue(''),
  setItem: vi.fn().mockResolvedValue(undefined),
};

function makeQuote(overrides: Partial<TransferQuote> = {}): TransferQuote {
  return {
    id: 'q1',
    sendAsset: SEND,
    receiveAsset: RECEIVE,
    sendAmount: '0.001',
    receiveAmount: '0.00099',
    rate: '1 BTC = 0.99 cBTC',
    fee: '0.00001',
    feeTicker: 'BTC',
    estimatedTime: 1800,
    expiresAt: Math.floor(Date.now() / 1000) + 600,
    serviceName: 'Atomiq',
    ...overrides,
  };
}

describe('AtomiqTransferService', () => {
  let service: AtomiqTransferService;
  // A real BIP84 wallet for TEST_MNEMONIC, used both to seed the UTXO mock and to independently
  // re-derive the addresses/keys the service should be using (so assertions test real derivation,
  // not values we fed into a mock).
  let owned: HDSegwitBech32Wallet;
  let ownedAddress: string;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getItem.mockResolvedValue('');
    setMasterSeed(TEST_MNEMONIC);

    owned = new HDSegwitBech32Wallet();
    owned.setSecret(TEST_MNEMONIC);
    owned.setDerivationPath("m/84'/0'/0'");
    ownedAddress = owned._getExternalAddressByIndex(0);

    // The funding builder pulls UTXOs from the BIP84 account over the network — stub it offline. The UTXO sits on a
    // real external-index-0 address so the (unmocked) key-by-address derivation resolves a real signing key.
    vi.spyOn(HDSegwitBech32Wallet.prototype, 'fetchBalance').mockResolvedValue(undefined);
    vi.spyOn(HDSegwitBech32Wallet.prototype, 'fetchUtxo').mockResolvedValue(undefined);
    vi.spyOn(HDSegwitBech32Wallet.prototype, 'getUtxo').mockReturnValue([{ height: 800000, address: ownedAddress, txid: 'aa'.repeat(32), vout: 0, value: 100000 }] as never);

    service = new AtomiqTransferService(mockStorage);
  });

  afterEach(() => {
    setMasterSeed('');
  });

  describe('getSupportedPairs', () => {
    it('supports only on-chain BTC → Citrea cBTC', () => {
      expect(service.getSupportedPairs()).toEqual([{ sendAssetId: SEND, receiveAssetId: RECEIVE }]);
    });
  });

  describe('getQuote', () => {
    it('builds a quote from the SDK swap', async () => {
      const quote = await service.getQuote(SEND, RECEIVE, '0.001');
      expect(quote.sendAsset).toBe(SEND);
      expect(quote.receiveAsset).toBe(RECEIVE);
      expect(quote.sendAmount).toBe('0.001');
      // Exact string (not parseFloat): cBTC has 18 decimals, so a regression to toFix(18) would
      // produce '0.000990000000000000' here and fail — this guards the trailing-zero stripping.
      expect(quote.receiveAmount).toBe('0.00099');
      expect(quote.fee).toBe('0.00001');
      expect(quote.feeTicker).toBe('BTC');
      expect(quote.serviceName).toBe('Atomiq');
      // /1000: the SDK reports expiry in ms; we store unix seconds.
      expect(quote.expiresAt).toBe(Math.floor(fakeSwap.getQuoteExpiry() / 1000));
    });

    it('strips trailing zeros from the receive amount instead of padding to the asset decimals', async () => {
      const original = fakeSwap.getOutput;
      fakeSwap.getOutput = () => ({ amount: '0.001' }); // would render as '0.001000000000000000' under toFixed(18)
      try {
        const quote = await service.getQuote(SEND, RECEIVE, '0.01');
        expect(quote.receiveAmount).toBe('0.001');
      } finally {
        fakeSwap.getOutput = original;
      }
    });

    it('rejects unsupported pairs', async () => {
      await expect(service.getQuote('native:rootstock', RECEIVE, '0.001')).rejects.toThrow('Atomiq only supports');
    });
  });

  describe('executeTransfer', () => {
    it('stages an instant execution with the settle address', async () => {
      const execution = await service.executeTransfer(makeQuote(), 0, '0xCitreaRecipient');
      expect(execution.type).toBe(EXECUTION_INSTANT);
      expect(execution.status).toBe('waiting');
      expect(execution.settleAddress).toBe('0xCitreaRecipient');
      expect(execution.providerId).toBe('swap-1');
      expect(execution.accountNumber).toBe(0);
    });

    it('rejects an expired quote', async () => {
      await expect(service.executeTransfer(makeQuote({ expiresAt: Math.floor(Date.now() / 1000) - 1 }), 0, '0xAddr')).rejects.toThrow('expired');
    });
  });

  describe('executeInstantSwap', () => {
    it('signs and broadcasts the BTC funding tx, returning confirming + txid', async () => {
      const staged = await service.executeTransfer(makeQuote(), 0, '0xCitreaRecipient');
      const committed = await service.executeInstantSwap(staged.id);

      expect(fakeSwap.sendBitcoinTransaction).toHaveBeenCalledTimes(1);
      // The SDK is handed a wallet-owned change address plus the account's full UTXO set for coin-selection.
      const [bitcoinWallet, , utxos] = fakeSwap.sendBitcoinTransaction.mock.calls[0];
      // Change must go to the account's change chain (m/84'/0'/0'/1/0), independently re-derived here —
      // not the reused external/receive address the UTXO sits on.
      expect(bitcoinWallet.address).toBe(owned._getInternalAddressByIndex(0));
      expect(bitcoinWallet.address).not.toBe(ownedAddress);
      expect(typeof bitcoinWallet.signPsbt).toBe('function');
      expect(Array.isArray(utxos)).toBe(true);
      expect(utxos.length).toBeGreaterThan(0);
      expect(utxos[0].type).toBe('p2wpkh');
      // The supplied UTXO carries the real output script for its owning address.
      expect(Buffer.from(utxos[0].outputScript).toString('hex')).toBe(Buffer.from(bitcoin.address.toOutputScript(ownedAddress, bitcoin.networks.bitcoin)).toString('hex'));

      expect(committed.status).toBe('confirming');
      expect(committed.depositTxid).toBe('btctxid-abc');
    });

    it('signs each PSBT input with the private key that owns that input', async () => {
      const staged = await service.executeTransfer(makeQuote(), 0, '0xCitreaRecipient');
      await service.executeInstantSwap(staged.id);
      const [bitcoinWallet, , utxos] = fakeSwap.sendBitcoinTransaction.mock.calls[0];

      // Feed back the funded UTXO's own script: signPsbt must map script → WIF and sign with the matching key.
      const signIdx = vi.fn();
      const psbt = { getInput: () => ({ witnessUtxo: { script: utxos[0].outputScript } }), signIdx };
      await bitcoinWallet.signPsbt({ psbt }, [0]);

      const expectedPrivKey = ECPair.fromWIF(owned._getWIFbyAddress(ownedAddress) as string).privateKey!;
      expect(signIdx).toHaveBeenCalledTimes(1);
      const [privKey, idx] = signIdx.mock.calls[0];
      expect(idx).toBe(0);
      // Real crypto, not a mock value: the resolved key must be the one owning the UTXO's address.
      expect(Buffer.from(privKey)).toEqual(Buffer.from(expectedPrivKey));
    });

    it('signPsbt refuses inputs it has no key for, and inputs missing a witnessUtxo', async () => {
      const staged = await service.executeTransfer(makeQuote(), 0, '0xCitreaRecipient');
      await service.executeInstantSwap(staged.id);
      const [bitcoinWallet] = fakeSwap.sendBitcoinTransaction.mock.calls[0];

      // A script for an address that wasn't among the funded UTXOs → no signing key.
      const foreignScript = bitcoin.address.toOutputScript(owned._getInternalAddressByIndex(7), bitcoin.networks.bitcoin);
      await expect(bitcoinWallet.signPsbt({ psbt: { getInput: () => ({ witnessUtxo: { script: foreignScript } }), signIdx: vi.fn() } }, [0])).rejects.toThrow('No signing key');

      // A missing witnessUtxo is a hard error (we can't identify the key), not a silent skip.
      await expect(bitcoinWallet.signPsbt({ psbt: { getInput: () => ({}), signIdx: vi.fn() } }, [0])).rejects.toThrow('Missing witnessUtxo');
    });

    it('throws (without broadcasting) when the account has no spendable UTXOs', async () => {
      vi.mocked(HDSegwitBech32Wallet.prototype.getUtxo).mockReturnValue([] as never);
      const staged = await service.executeTransfer(makeQuote(), 0, '0xCitreaRecipient');
      await expect(service.executeInstantSwap(staged.id)).rejects.toThrow('No spendable Bitcoin UTXOs');
      expect(fakeSwap.sendBitcoinTransaction).not.toHaveBeenCalled();
    });

    it('throws when the execution was never staged', async () => {
      await expect(service.executeInstantSwap('missing')).rejects.toThrow('No pending swap');
    });
  });

  describe('commitTransfer + getOngoingTransfers', () => {
    it('persists a committed transfer and returns it for the account', async () => {
      const staged = await service.executeTransfer(makeQuote(), 0, '0xCitreaRecipient');
      const committed = await service.executeInstantSwap(staged.id);
      await service.commitTransfer(committed);

      expect(mockStorage.setItem).toHaveBeenCalled();
      const saved = JSON.parse(mockStorage.setItem.mock.calls.at(-1)![1]);
      expect(saved).toHaveLength(1);
      expect(saved[0].swapId).toBe('swap-1');

      mockStorage.getItem.mockResolvedValue(JSON.stringify(saved));
      const ongoing = await service.getOngoingTransfers(0);
      expect(ongoing).toHaveLength(1);
      expect(ongoing[0].depositTxid).toBe('btctxid-abc');

      // A different account sees nothing.
      mockStorage.getItem.mockResolvedValue(JSON.stringify(saved));
      expect(await service.getOngoingTransfers(1)).toHaveLength(0);
    });

    it('auto-claims a BTC-confirmed swap on poll and marks it completed', async () => {
      const staged = await service.executeTransfer(makeQuote(), 0, '0xCitreaRecipient');
      const committed = await service.executeInstantSwap(staged.id);
      await service.commitTransfer(committed);
      mockStorage.getItem.mockResolvedValue(mockStorage.setItem.mock.calls.at(-1)![1]);

      // SDK now reports the swap as claimable (BTC confirmed, no watchtower settled it for us).
      const claim = vi.fn().mockResolvedValue(undefined);
      fakeSwapper.getSwapById.mockResolvedValueOnce({ getState: () => 'BTC_TX_CONFIRMED', getInputTxId: () => 'btctxid-abc', isClaimable: () => true, claim });

      const ongoing = await service.getOngoingTransfers(0);
      // The poll must settle it on the Citrea side (claim) and surface it as completed.
      expect(claim).toHaveBeenCalledTimes(1);
      expect(ongoing[0].status).toBe('completed');
    });
  });

  describe('getTrackingUrl', () => {
    it('links to mempool.space when a deposit txid exists', () => {
      const url = service.getTrackingUrl({ ...makeQuote(), depositTxid: 'abc' } as never);
      expect(url).toBe('https://mempool.space/tx/abc');
    });

    it('returns undefined without a deposit txid', () => {
      expect(service.getTrackingUrl({ ...makeQuote() } as never)).toBeUndefined();
    });
  });

  describe('mapSpvState', () => {
    it('maps SDK swap states to unified statuses', () => {
      expect(mapSpvState('CLAIMED' as never)).toBe('completed');
      expect(mapSpvState('FRONTED' as never)).toBe('completed');
      expect(mapSpvState('BTC_TX_CONFIRMED' as never)).toBe('claimable');
      expect(mapSpvState('BROADCASTED' as never)).toBe('confirming');
      expect(mapSpvState('CREATED' as never)).toBe('pending');
      expect(mapSpvState('QUOTE_EXPIRED' as never)).toBe('expired');
      expect(mapSpvState('FAILED' as never)).toBe('failed');
    });
  });
});
