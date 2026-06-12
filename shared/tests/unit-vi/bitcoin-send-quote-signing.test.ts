/**
 * Regression tests for the MCP Bitcoin send bug: "Can not finalize input #0".
 *
 * Root cause: `lazyInitWallet` created the Bitcoin watch-only wallet from an account-specific xpub
 * (derived at m/84'/0'/{account}') but never set the wallet's derivation path, so the inner HD wallet
 * kept the class default m/84'/0'/0'. The PSBT built by getSendQuote then embedded bip32Derivation
 * paths for account 0, and executeSendQuote derived the wrong keys from the mnemonic — every
 * signInput failed (and was silently swallowed), so finalizeAllInputs() blew up.
 *
 * The MCP tools use account MCP_BALANCE_ACCOUNT_NUMBER (4141, the "AI Agent" account), which is why
 * this only surfaced there: account 0 happens to match the default path.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { MCP_BALANCE_ACCOUNT_NUMBER } from '../../hooks/AccountNumberContext';
import { HDSegwitBech32Wallet } from '../../class/wallets/hd-segwit-bech32-wallet';
import { WatchOnlyWallet } from '../../class/wallets/watch-only-wallet';
import { WalletSerializer } from '../../modules/wallet-serializer';
import { clearWalletCache, lazyInitWallet, setMasterSeed } from '../../modules/wallet-utils';
import { IStorage, getSerializedStorageKey } from '../../types/IStorage';
import { NETWORK_BITCOIN } from '../../types/networks';

const { mockBroadcastV2, mockConnectMain } = vi.hoisted(() => ({
  mockBroadcastV2: vi.fn(),
  mockConnectMain: vi.fn(),
}));
vi.mock('../../blue_modules/BlueElectrum', () => ({
  broadcastV2: mockBroadcastV2,
  connectMain: mockConnectMain,
  mainConnected: true,
}));

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
// P2WPKH example address from BIP173 — just a valid mainnet receiver.
const RECEIVER = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';

function makeMemStorage(): IStorage {
  const m = new Map<string, string>();
  return {
    getItem: async (k: string) => m.get(k) ?? '',
    setItem: async (k: string, v: string) => {
      m.set(k, v);
    },
  } as IStorage;
}

beforeEach(() => {
  vi.clearAllMocks();
  clearWalletCache();
  setMasterSeed(MNEMONIC);
  mockBroadcastV2.mockResolvedValue('ok');
  mockConnectMain.mockResolvedValue(undefined);
});

describe('lazyInitWallet bitcoin derivation path', () => {
  it('pins the derivation path to the account on a freshly created wallet', async () => {
    const storage = makeMemStorage();
    const wallet = (await lazyInitWallet(NETWORK_BITCOIN, MCP_BALANCE_ACCOUNT_NUMBER, storage, storage)) as WatchOnlyWallet;
    expect(wallet.getDerivationPath()).toBe(`m/84'/0'/${MCP_BALANCE_ACCOUNT_NUMBER}'`);
  });

  it('pins the derivation path on a wallet restored from storage (stored by an older build with the default path)', async () => {
    const storage = makeMemStorage();

    // Simulate a wallet persisted by an older build: account-1 xpub, but inner HD wallet kept the
    // class-default derivation path m/84'/0'/0'.
    const hd = new HDSegwitBech32Wallet();
    hd.setSecret(MNEMONIC);
    hd.setDerivationPath("m/84'/0'/1'");
    const stale = new WatchOnlyWallet();
    stale.setSecret(hd.getXpub());
    stale.init();
    expect(stale.getDerivationPath()).toBe("m/84'/0'/0'"); // the stale default
    await storage.setItem(getSerializedStorageKey(NETWORK_BITCOIN, 1), await WalletSerializer.serialize(stale));

    const wallet = (await lazyInitWallet(NETWORK_BITCOIN, 1, storage, storage)) as WatchOnlyWallet;
    expect(wallet.getDerivationPath()).toBe("m/84'/0'/1'");
  });
});

describe('executeSendQuote signing for a non-zero account', () => {
  it('signs and broadcasts a quote built for the MCP (AI Agent) account', async () => {
    const storage = makeMemStorage();
    const wallet = (await lazyInitWallet(NETWORK_BITCOIN, MCP_BALANCE_ACCOUNT_NUMBER, storage, storage)) as WatchOnlyWallet;

    // Fabricate a UTXO on the wallet's first external address and build the PSBT exactly like
    // getSendQuote does (createTransaction on a watch-only wallet skips signing).
    const hdInstance = wallet._hdWalletInstance!;
    const utxos = [
      {
        txid: 'aa'.repeat(32),
        vout: 0,
        value: 100000,
        address: hdInstance._getExternalAddressByIndex(0),
      },
    ];
    const changeAddress = hdInstance._getInternalAddressByIndex(0);
    const { fee, psbt } = wallet.createTransaction(utxos, [{ address: RECEIVER, value: 50000 }], 1, changeAddress);

    const quote = {
      request: { toAddress: RECEIVER, amount: '50000', feeRate: 1 },
      fee: String(fee),
      feeTicker: 'BTC',
      _prepared: { psbt },
    };

    const txid = await wallet.executeSendQuote(quote, MNEMONIC, MCP_BALANCE_ACCOUNT_NUMBER);

    expect(txid).toMatch(/^[0-9a-f]{64}$/);
    expect(mockBroadcastV2).toHaveBeenCalledTimes(1);
  });
});
