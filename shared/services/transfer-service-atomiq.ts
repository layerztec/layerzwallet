import BigNumber from 'bignumber.js';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import { HDNodeWallet, Mnemonic, Wallet } from 'ethers';

import ecc from '@bitcoinerlab/secp256k1';
import { CitreaInitializer, EVMSigner } from '@atomiqlabs/chain-evm';
import { BitcoinNetwork, SpvFromBTCSwap, SpvFromBTCSwapState, SwapAmountType, SwapperFactory } from '@atomiqlabs/sdk';
import type { MinimalBitcoinWalletInterfaceWithSigner } from '@atomiqlabs/sdk';

import { HDSegwitBech32Wallet } from '../class/wallets/hd-segwit-bech32-wallet';
import { AllNetworkInfos } from '../models/all-network-infos';
import { getAssetInfo, toAssetId } from '../models/asset-info';
import { getRpcProvider } from '../models/network-getters';
import { uint8ArrayToHex } from '../modules/uint8array-extras';
import { getMasterSeed } from '../modules/wallet-utils';
import { IStorage, STORAGE_KEY_ATOMIQ_TRANSFERS } from '../types/IStorage';
import { AssetId } from '../types/asset';
import { NETWORK_BITCOIN, NETWORK_CITREA } from '../types/networks';
import { EXECUTION_INSTANT, isTerminalStatus, ITransferService, TimelineStep, TransferExecution, TransferPair, TransferQuote, TransferStatus } from '../types/transfer';
import { AtomiqChainStorage, AtomiqUnifiedStorage } from './atomiq-storage';
import { getExchangeTimelineSteps } from './transfer-service-sideshift';

const ECPair = ECPairFactory(ecc);

// Atomiq's SPV-vault protocol is trust-minimized BTC L1 → Citrea cBTC. Only this single route is wired.
const ATOMIQ_PAIRS: TransferPair[] = [{ sendAssetId: `native:${NETWORK_BITCOIN}`, receiveAssetId: `native:${NETWORK_CITREA}` }];

// EVM HD path (matches EvmWallet) — the Citrea recipient/claim signer is derived from it.
const EVM_HD_PATH = "m/44'/60'/0'/0";
// Placeholder Citrea recipient used only to price a quote (the real recipient is set at execute time).
const QUOTE_PLACEHOLDER_RECIPIENT = '0x0000000000000000000000000000000000000001';
const ESTIMATED_TIME_SECONDS = 1800;
const PRUNE_AGE_SECONDS = 7 * 24 * 60 * 60;

const Factory = new SwapperFactory<[typeof CitreaInitializer]>([CitreaInitializer]);
type AtomiqSwapper = ReturnType<typeof Factory.newSwapper>;

let rnPolyfillsApplied = false;

/**
 * React Native (Hermes) is missing a couple of Web/Node behaviours the Atomiq SDK depends on. We
 * shim them lazily — right before the Swapper is built, in the same bundle unit as the SDK call site,
 * so there is no reliance on module load order or a separate module's import side effect. Every patch
 * is feature-detected + idempotent, so this is a complete no-op on browser/desktop/Node.
 */
function ensureReactNativeSdkPolyfills(): void {
  if (rnPolyfillsApplied) return;
  rnPolyfillsApplied = true;
  patchAbortSignal();
  patchBufferSubarray();
}

/**
 * Hermes + RN's bundled `abort-controller` ship an AbortSignal that lacks three modern additions the
 * Atomiq dependency tree relies on, so all three must be shimmed (removing any of them breaks swaps):
 *   - `signal.throwIfAborted()` — called all over the SDK swap path (discovery, fetch plumbing, ticks).
 *   - static `AbortSignal.timeout()` — used by `@atomiqlabs/btc-mempool` for its fee-rate fetch; without
 *     it, getting a quote dies as `TypeError: AbortSignal.timeout is not a function` → empty fee prefetch
 *     → "Cannot get total fee in native token!" → swap creation "Aborted".
 *   - static `AbortSignal.any()` — same API family; shimmed for parity so a dep that combines signals
 *     can't reintroduce the same class of crash.
 * We patch the prototype of an *actual* signal instance and the global `AbortSignal` the deps reference,
 * so the fix lands regardless of global identity. Feature-detected + idempotent → a no-op on browser/desktop/Node.
 */
function patchAbortSignal(): void {
  const g = globalThis as typeof globalThis & {
    AbortController?: typeof AbortController;
    AbortSignal?: typeof AbortSignal & { timeout?: (ms: number) => AbortSignal; any?: (signals: Iterable<AbortSignal>) => AbortSignal };
    DOMException?: new (message?: string, name?: string) => Error;
  };
  if (typeof g.AbortController !== 'function') return;

  const makeAbortError = (message: string, name: string): Error => {
    if (typeof g.DOMException === 'function') return new g.DOMException(message, name);
    const err = new Error(message);
    err.name = name;
    return err;
  };

  const signalProto = Object.getPrototypeOf(new g.AbortController().signal) as AbortSignal & { throwIfAborted?: () => void };
  if (typeof g.AbortSignal !== 'function') {
    g.AbortSignal = signalProto.constructor as typeof AbortSignal & { timeout?: (ms: number) => AbortSignal; any?: (signals: Iterable<AbortSignal>) => AbortSignal };
  }
  const StaticTarget = g.AbortSignal as typeof AbortSignal & { timeout?: (ms: number) => AbortSignal; any?: (signals: Iterable<AbortSignal>) => AbortSignal };

  if (typeof signalProto.throwIfAborted !== 'function') {
    signalProto.throwIfAborted = function throwIfAborted(this: AbortSignal): void {
      if (this.aborted) throw (this.reason as Error | undefined) ?? makeAbortError('signal is aborted without reason', 'AbortError');
    };
  }
  if (typeof StaticTarget.timeout !== 'function') {
    StaticTarget.timeout = (ms: number): AbortSignal => {
      const controller = new g.AbortController!();
      setTimeout(() => controller.abort(makeAbortError('The operation timed out.', 'TimeoutError')), ms);
      return controller.signal;
    };
  }
  if (typeof StaticTarget.any !== 'function') {
    StaticTarget.any = (signals: Iterable<AbortSignal>): AbortSignal => {
      const controller = new g.AbortController!();
      for (const signal of signals) {
        if (signal.aborted) {
          controller.abort(signal.reason);
          break;
        }
        signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
      }
      return controller.signal;
    };
  }
}

/**
 * The `buffer` shim (feross/buffer, RN's global `Buffer`) overrides `slice` to return a `Buffer` but
 * leaves `subarray` inheriting `Uint8Array.prototype.subarray`, which relies on `Symbol.species` to
 * pick the result constructor. V8 honours species (so `buf.subarray()` is a `Buffer`), but Hermes
 * does not — there it returns a plain `Uint8Array` with no `readUInt32LE`/`copy`. The Atomiq EVM
 * BTC-relay parser does `Buffer.from(...).subarray(...)` and then calls those Node methods, which
 * blows up. We re-wrap the subarray result as a `Buffer` (zero-copy, mirroring feross's own `slice`).
 */
function patchBufferSubarray(): void {
  const BufferCtor = (globalThis as typeof globalThis & { Buffer?: typeof Buffer }).Buffer;
  if (typeof BufferCtor !== 'function') return;

  const probe = BufferCtor.from([0, 0, 0, 0]).subarray(0, 4) as Partial<Buffer>;
  if (typeof probe.readUInt32LE === 'function') return; // species honoured (V8/Node) — nothing to do

  const nativeSubarray = Uint8Array.prototype.subarray;
  BufferCtor.prototype.subarray = function subarray(this: Buffer, start?: number, end?: number): Buffer {
    const sub = nativeSubarray.call(this, start, end);
    Object.setPrototypeOf(sub, BufferCtor.prototype);
    return sub as unknown as Buffer;
  };
}

interface AtomiqPersistedTransfer {
  execution: TransferExecution;
  swapId: string;
}

interface StagedSwap {
  execution: TransferExecution;
  swap: SpvFromBTCSwap<any>;
  accountNumber: number;
}

/** Mirrors the SDK's `BitcoinWalletUtxo` (not exported from the package root). All our inputs are BIP84 p2wpkh. */
interface AtomiqUtxo {
  vout: number;
  txId: string;
  value: number;
  type: 'p2wpkh';
  outputScript: Buffer;
  address: string;
  confirmed: boolean;
}

interface BitcoinFunding {
  wallet: MinimalBitcoinWalletInterfaceWithSigner;
  utxos: AtomiqUtxo[];
}

/**
 * Atomiq on-chain BTC → Citrea cBTC via the @atomiqlabs SDK (SPV-vault swaps).
 *
 * Unlike deposit-address providers, the SDK builds a special funding PSBT that the wallet signs;
 * so this is modelled as a staged-execution provider (like Flashnet): `executeTransfer` creates the
 * swap, `executeInstantSwap` signs+broadcasts the BTC funding tx, and `getOngoingTransfers` polls
 * the SDK for settlement (auto-claiming on the Citrea side when needed).
 */
export class AtomiqTransferService implements ITransferService {
  readonly name = 'Atomiq';
  private storage: IStorage;
  private swapperPromise?: Promise<AtomiqSwapper>;
  private staged = new Map<string, StagedSwap>();

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  getSupportedPairs(): TransferPair[] {
    return ATOMIQ_PAIRS;
  }

  async getQuote(sendAsset: AssetId, receiveAsset: AssetId, sendAmount: string): Promise<TransferQuote> {
    this.assertPair(sendAsset, receiveAsset);
    const swap = await this.createSwap(sendAmount, QUOTE_PLACEHOLDER_RECIPIENT);
    return this.buildQuote(swap, sendAsset, receiveAsset, sendAmount);
  }

  async executeTransfer(quote: TransferQuote, accountNumber: number, settleAddress: string): Promise<TransferExecution> {
    if (Date.now() / 1000 > quote.expiresAt) {
      throw new Error('Quote has expired. Please get a new quote.');
    }
    this.assertPair(quote.sendAsset, quote.receiveAsset);

    const swap = await this.createSwap(quote.sendAmount, settleAddress);
    const now = Math.floor(Date.now() / 1000);
    const execution: TransferExecution = {
      type: EXECUTION_INSTANT,
      id: `atomiq-${now}-${Math.random().toString(36).slice(2, 8)}`,
      status: 'waiting',
      sendAmount: quote.sendAmount,
      receiveAmount: this.outputAmount(swap, quote.receiveAsset),
      sendAsset: quote.sendAsset,
      receiveAsset: quote.receiveAsset,
      settleAddress,
      providerId: swap.getId(),
      createdAt: now,
      updatedAt: now,
      accountNumber,
      serviceName: this.name,
    };

    this.staged.set(execution.id, { execution, swap, accountNumber });
    return execution;
  }

  /** Signs and broadcasts the BTC funding transaction. Returns once the tx is sent (settlement is async). */
  async executeInstantSwap(executionId: string): Promise<TransferExecution> {
    const staged = this.staged.get(executionId);
    if (!staged) {
      throw new Error(`No pending swap found for execution ${executionId}. It may have expired or already been executed.`);
    }
    this.staged.delete(executionId);

    const { wallet, utxos } = await this.buildBitcoinFunding(staged.accountNumber);
    if (utxos.length === 0) throw new Error('No spendable Bitcoin UTXOs found for this account');
    const btcTxId = await staged.swap.sendBitcoinTransaction(wallet, undefined, utxos);

    const now = Math.floor(Date.now() / 1000);
    return {
      ...staged.execution,
      status: 'confirming',
      depositTxid: btcTxId,
      providerId: staged.swap.getId(),
      updatedAt: now,
    };
  }

  async commitTransfer(execution: TransferExecution): Promise<void> {
    if (!execution.providerId) return;
    const transfers = await this.loadTransfers();
    const idx = transfers.findIndex((t) => t.execution.id === execution.id);
    if (idx >= 0) {
      transfers[idx].execution = { ...transfers[idx].execution, ...execution };
    } else {
      transfers.push({ execution, swapId: execution.providerId });
    }
    await this.saveTransfers(transfers);
  }

  async getOngoingTransfers(accountNumber: number): Promise<TransferExecution[]> {
    const transfers = await this.loadTransfers();
    const now = Math.floor(Date.now() / 1000);
    const active: AtomiqPersistedTransfer[] = [];

    for (const t of transfers) {
      const isTerminal = isTerminalStatus(t.execution.status);
      if (isTerminal && now - t.execution.createdAt > PRUNE_AGE_SECONDS) continue;
      if (!isTerminal) await this.syncTransfer(t, now);
      active.push(t);
    }

    await this.saveTransfers(active);
    return active.filter((t) => t.execution.accountNumber === accountNumber).map((t) => t.execution);
  }

  async refreshTransferStatus(executionId: string): Promise<TransferExecution> {
    const transfers = await this.loadTransfers();
    const transfer = transfers.find((t) => t.execution.id === executionId);
    if (!transfer) throw new Error(`Transfer ${executionId} not found`);
    await this.syncTransfer(transfer, Math.floor(Date.now() / 1000));
    await this.saveTransfers(transfers);
    return transfer.execution;
  }

  getTimelineSteps(execution: TransferExecution): TimelineStep[] {
    return getExchangeTimelineSteps(execution);
  }

  getTrackingUrl(execution: TransferExecution): string | undefined {
    return execution.depositTxid ? `https://mempool.space/tx/${execution.depositTxid}` : undefined;
  }

  // ── internals ──────────────────────────────────────────────────────────────────────────────────

  private assertPair(sendAsset: AssetId, receiveAsset: AssetId): void {
    if (sendAsset !== `native:${NETWORK_BITCOIN}` || receiveAsset !== `native:${NETWORK_CITREA}`) {
      throw new Error('Atomiq only supports on-chain BTC → Citrea cBTC');
    }
  }

  private async createSwap(sendAmount: string, recipient: string): Promise<SpvFromBTCSwap<any>> {
    const swapper = await this.ensureSwapper();
    const swap = await swapper.swap(Factory.Tokens.BITCOIN.BTC, Factory.Tokens.CITREA.CBTC, sendAmount, SwapAmountType.EXACT_IN, undefined, recipient);
    return swap as SpvFromBTCSwap<any>;
  }

  private buildQuote(swap: SpvFromBTCSwap<any>, sendAsset: AssetId, receiveAsset: AssetId, sendAmount: string): TransferQuote {
    const sendInfo = getAssetInfo(sendAsset);
    const receiveInfo = getAssetInfo(receiveAsset);
    const receiveAmount = this.outputAmount(swap, receiveAsset);
    const fee = swap.getFee().amountInSrcToken.amount || '0';
    const rateValue = new BigNumber(receiveAmount).div(sendAmount).toFixed(8);

    return {
      id: `atomiq-${Date.now()}`,
      sendAsset,
      receiveAsset,
      sendAmount,
      receiveAmount,
      rate: `1 ${sendInfo.ticker} = ${rateValue} ${receiveInfo.ticker}`,
      fee,
      feeTicker: sendInfo.ticker,
      estimatedTime: ESTIMATED_TIME_SECONDS,
      expiresAt: Math.floor(swap.getQuoteExpiry() / 1000),
      serviceName: this.name,
    };
  }

  private outputAmount(swap: SpvFromBTCSwap<any>, receiveAsset: AssetId): string {
    // Cap at the asset's precision but drop trailing zeros — toFixed(decimals) would pad an
    // 18-decimal asset (cBTC) to e.g. "0.000990000000000000", which is noise in the UI.
    return new BigNumber(swap.getOutput().amount).decimalPlaces(getAssetInfo(receiveAsset).decimals).toFixed();
  }

  private async syncTransfer(transfer: AtomiqPersistedTransfer, now: number): Promise<void> {
    try {
      const swapper = await this.ensureSwapper();
      const swap = (await swapper.getSwapById(transfer.swapId)) as unknown as SpvFromBTCSwap<any> | undefined;
      if (!swap) return;

      transfer.execution.status = mapSpvState(swap.getState());
      transfer.execution.depositTxid = transfer.execution.depositTxid ?? swap.getInputTxId() ?? undefined;
      transfer.execution.updatedAt = now;

      // BTC confirmed but the destination wasn't auto-settled by a watchtower — settle it ourselves.
      if (swap.isClaimable()) {
        try {
          await swap.claim(this.buildCitreaSigner(transfer.execution.accountNumber));
          transfer.execution.status = 'completed';
        } catch (e) {
          console.warn(`Atomiq claim failed for ${transfer.swapId}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch (e) {
      console.warn(`Failed to sync Atomiq swap ${transfer.swapId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private ensureSwapper(): Promise<AtomiqSwapper> {
    if (!this.swapperPromise) {
      ensureReactNativeSdkPolyfills();
      this.swapperPromise = (async () => {
        const swapper = Factory.newSwapper({
          chains: { CITREA: { rpcUrl: AllNetworkInfos[NETWORK_CITREA].rpcUrl } },
          bitcoinNetwork: BitcoinNetwork.MAINNET,
          swapStorage: (name) => new AtomiqUnifiedStorage(this.storage, name),
          chainStorageCtor: (name) => new AtomiqChainStorage(this.storage, name),
          // Don't persist quote-only swaps; they're saved once the BTC tx is broadcast.
          saveUninitializedSwaps: false,
        });
        await swapper.init();
        return swapper;
      })().catch((e) => {
        this.swapperPromise = undefined;
        throw e;
      });
    }
    return this.swapperPromise;
  }

  private getMnemonic(): string {
    const mnemonic = getMasterSeed();
    if (!mnemonic) throw new Error('Wallet is locked');
    return mnemonic;
  }

  /**
   * Builds the full set of spendable UTXOs across the BIP84 account (every receive + change address) and a signer
   * that signs each PSBT input with the key owning that input. The SDK runs coin-selection over the supplied UTXOs
   * (instead of the single-address pool it would otherwise fetch), so the entire on-chain balance is spendable; change
   * is returned to the account's next free change-chain address.
   */
  private async buildBitcoinFunding(accountNumber: number): Promise<BitcoinFunding> {
    const hd = new HDSegwitBech32Wallet();
    hd.setSecret(this.getMnemonic());
    hd.setDerivationPath(`m/84'/0'/${accountNumber}'`);

    await hd.fetchBalance();
    await hd.fetchUtxo();

    // Map each input's witnessUtxo script → WIF; the SDK funds p2wpkh inputs with exactly the outputScript we pass here.
    const scriptToWif = new Map<string, string>();
    const utxos: AtomiqUtxo[] = [];
    for (const utxo of hd.getUtxo()) {
      const outputScript = Buffer.from(bitcoin.address.toOutputScript(utxo.address, bitcoin.networks.bitcoin));
      const scriptHex = outputScript.toString('hex');
      if (!scriptToWif.has(scriptHex)) {
        const wif = hd._getWIFbyAddress(utxo.address);
        if (!wif) throw new Error(`Unable to derive signing key for UTXO address ${utxo.address}`);
        scriptToWif.set(scriptHex, wif);
      }
      utxos.push({ vout: utxo.vout, txId: utxo.txid, value: utxo.value, type: 'p2wpkh', outputScript, address: utxo.address, confirmed: (utxo.height ?? 0) > 0 });
    }

    // Return change to a real change-chain address (m/84'/0'/{account}'/1/k), not a reused external
    // address. fetchBalance() above already advanced next_free_change_address_index past used ones.
    const changeIndex = hd.next_free_change_address_index;
    const changeAddress = hd._getInternalAddressByIndex(changeIndex);
    const changeWif = hd._getInternalWIFByIndex(changeIndex);
    if (!changeWif) throw new Error('Unable to derive Bitcoin change key');
    const changePublicKey = uint8ArrayToHex(ECPair.fromWIF(changeWif).publicKey);

    const wallet: MinimalBitcoinWalletInterfaceWithSigner = {
      address: changeAddress,
      publicKey: changePublicKey,
      signPsbt: async ({ psbt }, signInputs) => {
        for (const idx of signInputs) {
          // `witnessUtxo.script` is `Bytes` (Uint8Array) at runtime, but @scure/btc-signer's
          // coder-derived input type resolves to `{}` under some TS setups (mobile), so assert it.
          const script = psbt.getInput(idx).witnessUtxo?.script as Uint8Array | undefined;
          if (!script) throw new Error(`Missing witnessUtxo for input ${idx}`);
          const wif = scriptToWif.get(uint8ArrayToHex(script));
          if (!wif) throw new Error(`No signing key for input ${idx}`);
          const privateKey = ECPair.fromWIF(wif).privateKey;
          if (!privateKey) throw new Error('Unable to derive Bitcoin private key');
          psbt.signIdx(privateKey, idx);
        }
        return psbt;
      },
    };

    return { wallet, utxos };
  }

  private buildCitreaSigner(accountNumber: number): EVMSigner {
    const hdNode = HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(this.getMnemonic()), EVM_HD_PATH).derivePath(String(accountNumber));
    const wallet = new Wallet(hdNode.privateKey, getRpcProvider(NETWORK_CITREA));
    return new EVMSigner(wallet, wallet.address);
  }

  private async loadTransfers(): Promise<AtomiqPersistedTransfer[]> {
    const raw = await this.storage.getItem(STORAGE_KEY_ATOMIQ_TRANSFERS);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as AtomiqPersistedTransfer[];
      const result: AtomiqPersistedTransfer[] = [];
      for (const transfer of parsed) {
        const sendAsset = toAssetId(transfer.execution.sendAsset);
        const receiveAsset = toAssetId(transfer.execution.receiveAsset);
        if (!sendAsset || !receiveAsset) continue;
        result.push({ ...transfer, execution: { ...transfer.execution, sendAsset, receiveAsset } });
      }
      return result;
    } catch {
      return [];
    }
  }

  private async saveTransfers(transfers: AtomiqPersistedTransfer[]): Promise<void> {
    await this.storage.setItem(STORAGE_KEY_ATOMIQ_TRANSFERS, JSON.stringify(transfers));
  }
}

/** Map the SDK's SPV-vault swap state to our unified TransferStatus. */
export function mapSpvState(state: SpvFromBTCSwapState): TransferStatus {
  switch (state) {
    case SpvFromBTCSwapState.CLAIMED:
    case SpvFromBTCSwapState.FRONTED:
      return 'completed';
    case SpvFromBTCSwapState.BTC_TX_CONFIRMED:
      return 'claimable';
    case SpvFromBTCSwapState.POSTED:
    case SpvFromBTCSwapState.BROADCASTED:
      return 'confirming';
    case SpvFromBTCSwapState.CREATED:
    case SpvFromBTCSwapState.SIGNED:
    case SpvFromBTCSwapState.QUOTE_SOFT_EXPIRED:
      return 'pending';
    case SpvFromBTCSwapState.QUOTE_EXPIRED:
      return 'expired';
    case SpvFromBTCSwapState.CLOSED:
    case SpvFromBTCSwapState.FAILED:
    case SpvFromBTCSwapState.DECLINED:
    default:
      return 'failed';
  }
}
