import * as BlueElectrum from '@shared/blue_modules/BlueElectrum';
import { EvmWallet } from '@shared/class/evm-wallet';
import { HDSegwitBech32Wallet } from '@shared/class/wallets/hd-segwit-bech32-wallet';
import { SparkWallet } from '@shared/class/wallets/spark-wallet';

import { LayerzStorage } from '../class/layerz-storage';
import { Csprng } from '../class/rng';
import { decrypt, encrypt } from './encryption';

/** Result of a single self-diagnostic check. */
export interface DiagnosticResult {
  name: string;
  ok: boolean;
  detail: string;
}

/** Well-known BIP39 test vector — never holds funds, used purely for deterministic derivation checks. */
const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const TEST_SALT = '53B63311-D2D5-4C62-9F7F-28F25447B825';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

/** Run one named check, capturing timing and turning any throw into a failed result. */
async function check(name: string, fn: () => Promise<string | void>): Promise<DiagnosticResult> {
  const start = Date.now();
  try {
    const detail = await fn();
    const elapsed = Date.now() - start;
    return { name, ok: true, detail: detail ? `${detail} (${elapsed}ms)` : `ok (${elapsed}ms)` };
  } catch (error) {
    return { name, ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Runs all self-diagnostics sequentially and returns a result per check.
 * Covers runtime polyfills/shims, build-time env inlining, the renderer↔Bun storage
 * bridge, lazily-loaded WASM adapters, deterministic crypto/derivation, and live network.
 */
export async function runSelfDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];

  // --- Runtime shims (Vite polyfills the Node globals these wallets depend on) ---
  results.push(
    await check('Buffer polyfill', async () => {
      const buffer = Buffer.from('ffff', 'hex');
      assert(buffer.toString('hex') === 'ffff', 'Buffer round-trip mismatch');
      return 'ffff round-trip';
    })
  );

  results.push(
    await check('crypto.randomUUID', async () => {
      assert(typeof globalThis.crypto?.randomUUID === 'function', 'crypto.randomUUID missing');
      const uuid = globalThis.crypto.randomUUID();
      assert(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid), `expected RFC 4122 v4, got ${uuid}`);
      return uuid;
    })
  );

  results.push(
    await check('global/process shims', async () => {
      assert(typeof globalThis !== 'undefined', 'globalThis missing');
      assert(typeof global !== 'undefined', 'global shim missing (Vite define)');
      assert(typeof process !== 'undefined', 'process shim missing');
      return 'globalThis, global, process present';
    })
  );

  // --- Build-time env inlining (Vite define: NODE_ENV + every EXPO_PUBLIC_* var) ---
  results.push(
    await check('Build env inlined', async () => {
      assert(typeof process.env.NODE_ENV === 'string' && process.env.NODE_ENV.length > 0, 'NODE_ENV not inlined');
      assert((process as { browser?: boolean }).browser === true, 'process.browser not inlined');
      // These are inlined as strings (possibly empty) when wiring works; undefined means inlining is broken.
      const breezWired = typeof process.env.EXPO_PUBLIC_BREEZ_API_KEY === 'string';
      const breezSet = breezWired && process.env.EXPO_PUBLIC_BREEZ_API_KEY!.length > 0;
      const gardenSet = typeof process.env.EXPO_PUBLIC_GARDEN_APP_ID === 'string' && process.env.EXPO_PUBLIC_GARDEN_APP_ID.length > 0;
      assert(breezWired, 'EXPO_PUBLIC_* vars not inlined by Vite');
      return `NODE_ENV=${process.env.NODE_ENV}, breez ${breezSet ? 'set' : 'empty'}, garden ${gardenSet ? 'set' : 'empty'}`;
    })
  );

  // --- Renderer↔Bun storage bridge (CEF does not persist views:// localStorage on Linux) ---
  results.push(
    await check('Storage RPC round-trip', async () => {
      const key = '__diagnostics_probe__';
      const value = `probe-${Date.now()}`;
      await LayerzStorage.setItem(key, value);
      const readBack = await LayerzStorage.getItem(key);
      assert(readBack === value, `storage round-trip mismatch: wrote "${value}", read "${readBack}"`);
      await LayerzStorage.setItem(key, ''); // clean up probe key
      return 'set/get over Bun RPC';
    })
  );

  // --- Lazily-loaded WASM SDK adapters (must be wired onto globalThis before wallets work) ---
  results.push(
    await check('Breez adapter wired', async () => {
      assert(typeof globalThis.breezAdapter !== 'undefined', 'globalThis.breezAdapter not initialized');
      return 'breezAdapter present';
    })
  );

  results.push(
    await check('Spark adapter wired', async () => {
      assert(typeof globalThis.sparkAdapter !== 'undefined', 'globalThis.sparkAdapter not initialized');
      return 'sparkAdapter present';
    })
  );

  // --- Deterministic crypto & key derivation (catches broken wallet logic / bad bundling) ---
  results.push(
    await check('EVM derivation (BIP44)', async () => {
      const xpub = EvmWallet.mnemonicToXpub(TEST_MNEMONIC);
      assert(xpub === 'xpub6EF8jXqFeFEW5bwMU7RpQtHkzE4KJxcqJtvkCjJumzW8CPpacXkb92ek4WzLQXjL93HycJwTPUAcuNxCqFPKKU5m5Z2Vq4nCyh5CyPeBFFr', `unexpected EVM xpub: ${xpub}`);
      assert(EvmWallet.xpubToAddress(xpub, 0) === '0x9858EfFD232B4033E47d90003D41EC34EcaEda94', 'unexpected EVM address #0');
      assert(EvmWallet.xpubToAddress(xpub, 1) === '0x6Fac4D18c912343BF86fa7049364Dd4E424Ab9C0', 'unexpected EVM address #1');
      return 'xpub + addresses match';
    })
  );

  results.push(
    await check('Bitcoin derivation (BIP84)', async () => {
      const hd = new HDSegwitBech32Wallet();
      hd.setSecret(TEST_MNEMONIC);
      assert(hd.validateMnemonic(), 'mnemonic failed to validate');
      assert(hd.getXpub() === 'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs', 'unexpected BTC zpub');
      assert(hd._getExternalWIFByIndex(0) === 'KyZpNDKnfs94vbrwhJneDi77V6jF64PWPF8x5cdJb8ifgg2DUc9d', 'unexpected external WIF #0');
      assert(hd._getExternalAddressByIndex(0) === 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu', 'unexpected external address #0');
      assert(hd._getInternalAddressByIndex(0) === 'bc1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el', 'unexpected internal address #0');
      return 'zpub + WIF + addresses match';
    })
  );

  results.push(
    await check('Encryption round-trip', async () => {
      const plaintext = 'really long data string bla bla really long data string bla bla really long data string bla bla';
      const crypted = await encrypt(Csprng, plaintext, 'password', TEST_SALT);
      const decrypted = await decrypt(crypted, 'password', TEST_SALT);
      assert(decrypted === plaintext, 'decrypted text does not match original');
      return 'encrypt + decrypt match';
    })
  );

  results.push(
    await check('Spark wallet address', async () => {
      const w = new SparkWallet();
      w.setSecret(TEST_MNEMONIC);
      await w.init(LayerzStorage);
      const address = await w.getOffchainReceiveAddress();
      assert(address === 'spark1pgss9qfk8ygtphqqzkj2yhn43k3s7r3g8z822ffvpcm38ym094800574x5numh', `unexpected spark address: ${address}`);
      return 'offchain receive address matches';
    })
  );

  // --- Live network (Electrum) — last because it is the slowest / most flake-prone ---
  results.push(
    await check('Electrum connectivity', async () => {
      if (!BlueElectrum.mainConnected) {
        await BlueElectrum.connectMain();
      }
      const balance = await BlueElectrum.getBalanceByAddress('3GCvDBAktgQQtsbN6x5DYiQCMmgZ9Yk8BK');
      assert(balance.confirmed === 51432, `unexpected electrum balance: ${balance.confirmed}`);
      return `confirmed balance ${balance.confirmed} sats`;
    })
  );

  return results;
}
