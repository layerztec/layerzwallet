import BigNumber from 'bignumber.js';

import type { SparkSDKWallet } from '../class/wallets/spark-wallet';
import { AllNetworkInfos } from '../models/all-network-infos';
import { getAssetInfo } from '../models/asset-info';
import { IStorage, STORAGE_KEY_SPARK_EXIT_TRANSFERS } from '../types/IStorage';
import { AssetId } from '../types/asset';
import { NETWORK_BITCOIN } from '../types/networks';
import {
  EXECUTION_SPARK_EXIT,
  isTerminalStatus,
  ITransferService,
  SparkExitExecution,
  TimelineStep,
  TransferExecution,
  TransferPair,
  TransferPairInfo,
  TransferQuote,
  TransferStatus,
} from '../types/transfer';

// Derived from public `SparkSDKWallet` signatures: the SDK doesn't re-export these types from
// its package root, and a `dist/` subpath import would couple `shared/` to its build layout.
type CoopExitFeeQuote = NonNullable<Awaited<ReturnType<SparkSDKWallet['getWithdrawalFeeQuote']>>>;
type CoopExitRequestStatus = NonNullable<Awaited<ReturnType<SparkSDKWallet['getCoopExitRequest']>>>['status'];

const PRUNE_AGE_SECONDS = 7 * 24 * 60 * 60;
const PENDING_QUOTE_TTL = 5 * 60; // 5 minutes — matches typical CoopExitFeeQuote expiry
const PENDING_EXIT_TTL = 5 * 60;

/** Default exit speed for v1. The SDK quote returns fees for FAST/MEDIUM/SLOW; we pick MEDIUM. */
const DEFAULT_EXIT_SPEED: 'FAST' | 'MEDIUM' | 'SLOW' = 'MEDIUM';

/**
 * BIP173 spec test-vector P2WPKH address. Used as a placeholder destination for
 * `getWithdrawalFeeQuote()` because the user's real Bitcoin address isn't known at
 * quote time (the interface signature `getQuote(send, receive, amount)` doesn't carry
 * a destination, and quoting happens in `index.tsx` before the user reaches `confirm.tsx`).
 *
 * Why this is safe: the SDK's fee depends on (a) Spark-side userFee (independent of
 * destination), and (b) L1 broadcast fee, which depends on tx vbytes. P2WPKH outputs
 * are 22 bytes — the same as any sensible mainnet receive address — so the L1 fee
 * estimate using this placeholder matches the actual withdrawal within sub-sat noise.
 *
 * The real destination address is bound at `withdraw()` time via the `onchainAddress`
 * parameter; the `feeQuoteId` from the quote is amount-bound, not address-bound.
 */
const QUOTE_PLACEHOLDER_ADDRESS = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';

const SUPPORTED_PAIRS: TransferPair[] = [{ sendAssetId: 'native:spark', receiveAssetId: 'native:bitcoin' }];

interface SparkExitPersistedTransfer {
  execution: SparkExitExecution;
}

interface PendingQuoteParams {
  amountSats: number;
  feeQuoteId: string;
  feeAmountSats: number;
  exitSpeed: 'FAST' | 'MEDIUM' | 'SLOW';
  /**
   * The account active at quote time — the SDK's `feeQuoteId` is bound to the wallet session
   * that produced it, so `executeTransfer` must reject if the caller's `accountNumber` doesn't
   * match. Without this check, an account switch between quote and Continue tap would push a
   * cross-account feeQuoteId into `withdraw()` and either be rejected by the SSP (best case)
   * or debit the wrong account (worst case).
   */
  accountNumber: number;
  quote: TransferQuote;
  createdAt: number;
}

interface PendingExitParams {
  amountSats: number;
  receiveAmountSats: number;
  feeQuoteId: string;
  feeAmountSats: number;
  exitSpeed: 'FAST' | 'MEDIUM' | 'SLOW';
  onchainAddress: string;
  accountNumber: number;
  sendAsset: AssetId;
  receiveAsset: AssetId;
  sendAmount: string;
  receiveAmount: string;
  createdAt: number;
}

export class SparkExitTransferService implements ITransferService {
  readonly name = 'SparkExit';
  private storage: IStorage;
  private getSparkWallet: (accountNumber: number) => SparkSDKWallet | undefined;
  private currentAccountNumber: number = 0;
  private pendingQuotes: Map<string, PendingQuoteParams> = new Map();
  private pendingExits: Map<string, PendingExitParams> = new Map();
  /**
   * IDs whose `executeInstantSwap` call is currently in-flight (SDK `withdraw()` is awaiting).
   * A second concurrent call for the same id throws "already in progress" rather than entering
   * `withdraw()` twice. Independent of `pendingExits` because we want concurrent-call protection
   * to be orthogonal to the success/failure cleanup of the staging map.
   */
  private inFlightExits: Set<string> = new Set();

  constructor(storage: IStorage, getSparkWallet: (accountNumber: number) => SparkSDKWallet | undefined) {
    this.storage = storage;
    this.getSparkWallet = getSparkWallet;
  }

  setCurrentAccountNumber(accountNumber: number): void {
    this.currentAccountNumber = accountNumber;
  }

  getSupportedPairs(): TransferPair[] {
    return SUPPORTED_PAIRS;
  }

  async getPairInfo(_send: AssetId, _receive: AssetId): Promise<TransferPairInfo> {
    // Min is the Spark→BTC effective dust limit: anything smaller would be eaten by fees.
    // ~1000 sats is a reasonable floor that covers L1 dust (546 sats) + Spark userFee headroom.
    // Max is an arbitrary safety cap; raise if users hit it.
    return { min: '0.00001', max: '1', rate: '1' };
  }

  async getQuote(sendAsset: AssetId, receiveAsset: AssetId, sendAmount: string): Promise<TransferQuote> {
    const sendInfo = getAssetInfo(sendAsset);
    const receiveInfo = getAssetInfo(receiveAsset);

    const wallet = this.requireWallet();
    const amountSats = new BigNumber(sendAmount).times(new BigNumber(10).pow(sendInfo.decimals)).integerValue(BigNumber.ROUND_FLOOR).toNumber();

    // SIDE EFFECT: per SDK docs, getWithdrawalFeeQuote may restructure the wallet's leaves
    // via an SSP swap so they exactly match `amountSats`. This is unavoidable — it's how
    // the SDK guarantees the fee quote reflects the actual leaves the subsequent withdraw()
    // will consume. Documented in `.agents/swap.md`.
    const feeQuote = await wallet.getWithdrawalFeeQuote({ amountSats, withdrawalAddress: QUOTE_PLACEHOLDER_ADDRESS });
    if (!feeQuote) {
      throw new Error('Spark withdrawal fee quote unavailable');
    }

    const exitSpeed = DEFAULT_EXIT_SPEED;
    const userFeeSats = pickUserFee(feeQuote, exitSpeed);
    const l1BroadcastFeeSats = pickL1Fee(feeQuote, exitSpeed);
    const feeAmountSats = userFeeSats + l1BroadcastFeeSats;

    // Receive amount = send amount minus the total fee (deductFeeFromWithdrawalAmount=false at withdraw time
    // would charge the fee separately, but for the UI we present a net-of-fee receive figure so the user can
    // see exactly what they'll get on L1).
    const receiveAmountSats = Math.max(0, amountSats - feeAmountSats);

    const sendAmountHuman = new BigNumber(amountSats).div(new BigNumber(10).pow(sendInfo.decimals)).toFixed(sendInfo.decimals);
    const receiveAmountHuman = new BigNumber(receiveAmountSats).div(new BigNumber(10).pow(receiveInfo.decimals)).toFixed(receiveInfo.decimals);
    const feeHuman = new BigNumber(feeAmountSats).div(new BigNumber(10).pow(sendInfo.decimals)).toFixed(sendInfo.decimals);

    // 1:1 rate makes sense for BTC-on-Spark → BTC-on-Bitcoin; both sides are denominated in BTC.
    const rate = `1 ${sendInfo.ticker} = 1 ${receiveInfo.ticker} (minus ${feeHuman} BTC fee)`;

    const now = Math.floor(Date.now() / 1000);
    const quoteId = `spark-exit-${now}-${Math.random().toString(36).slice(2, 8)}`;

    const quote: TransferQuote = {
      id: quoteId,
      sendAsset,
      receiveAsset,
      sendAmount: sendAmountHuman,
      receiveAmount: receiveAmountHuman,
      rate,
      fee: feeHuman,
      feeTicker: sendInfo.ticker,
      feeBaseUnits: feeAmountSats.toFixed(0),
      estimatedTime: 30 * 60, // ~30 min ballpark; depends on Bitcoin confirmation time at chosen speed
      expiresAt: quoteExpiresAt(feeQuote, now),
      serviceName: this.name,
    };

    this.prunePendingQuotes(now);
    this.pendingQuotes.set(quoteId, {
      amountSats,
      feeQuoteId: feeQuote.id,
      feeAmountSats,
      exitSpeed,
      // Capture the account the SDK quote was bound to. executeTransfer will reject a mismatch.
      accountNumber: this.currentAccountNumber,
      quote,
      createdAt: now,
    });

    return quote;
  }

  async executeTransfer(quote: TransferQuote, accountNumber: number, settleAddress: string, _fromAddress?: string): Promise<TransferExecution> {
    if (!settleAddress) {
      throw new Error('Bitcoin destination address is required for Spark→BTC withdrawal');
    }

    const pending = this.pendingQuotes.get(quote.id);
    if (!pending) {
      throw new Error('Quote not found or expired. Please re-quote and try again.');
    }
    // The SDK's `feeQuoteId` is bound to the wallet that produced it. If the user switched
    // accounts between getQuote and Continue, the staged feeQuoteId would belong to the wrong
    // wallet — and would either be rejected by the SSP or, worse, debit the wrong account.
    // Fail loudly and force a re-quote on the new account.
    if (pending.accountNumber !== accountNumber) {
      this.pendingQuotes.delete(quote.id);
      throw new Error('Account changed since the quote was generated. Please re-quote and try again.');
    }
    this.pendingQuotes.delete(quote.id);

    const sendInfo = getAssetInfo(quote.sendAsset);
    const receiveInfo = getAssetInfo(quote.receiveAsset);
    const receiveAmountSats = new BigNumber(quote.receiveAmount).times(new BigNumber(10).pow(receiveInfo.decimals)).integerValue(BigNumber.ROUND_FLOOR).toNumber();

    const now = Math.floor(Date.now() / 1000);
    const executionId = `spark-exit-${now}-${Math.random().toString(36).slice(2, 8)}`;

    this.prunePendingExits(now);
    this.pendingExits.set(executionId, {
      amountSats: pending.amountSats,
      receiveAmountSats,
      feeQuoteId: pending.feeQuoteId,
      feeAmountSats: pending.feeAmountSats,
      exitSpeed: pending.exitSpeed,
      onchainAddress: settleAddress,
      accountNumber,
      sendAsset: quote.sendAsset,
      receiveAsset: quote.receiveAsset,
      sendAmount: quote.sendAmount,
      receiveAmount: quote.receiveAmount,
      createdAt: now,
    });

    // Return a transient (not yet persisted) execution. The actual withdraw() happens in
    // executeInstantSwap when the user taps Confirm. We return EXECUTION_SPARK_EXIT with
    // no coopExitRequestId yet — confirm.tsx routes this through executeInstantSwap because
    // TransferServiceManager.executionOwners is populated for any service implementing
    // executeInstantSwap (we do).
    const execution: SparkExitExecution = {
      type: EXECUTION_SPARK_EXIT,
      id: executionId,
      status: 'pending',
      sendAmount: quote.sendAmount,
      receiveAmount: quote.receiveAmount,
      sendAsset: quote.sendAsset,
      receiveAsset: quote.receiveAsset,
      createdAt: now,
      updatedAt: now,
      settleAddress,
      accountNumber,
      serviceName: this.name,
      coopExitRequestId: '', // populated in executeInstantSwap
      exitSpeed: pending.exitSpeed,
    };
    void sendInfo; // satisfy linter — keeping for future use if we add validation here
    return execution;
  }

  /**
   * Commits the irreversible Spark SDK `withdraw()` call. The contract mirrors Flashnet's
   * `executeInstantSwap`: the manager routes here by execution id when the user confirms.
   *
   * Lifecycle invariants (these are why this method is more elaborate than the Flashnet equivalent):
   *
   * 1. **Concurrent-call protection.** `inFlightExits` blocks a second call for the same id while
   *    the SDK promise is awaiting. A double-tap on Confirm therefore cannot enter `withdraw()`
   *    twice and produce two cooperative exits.
   *
   * 2. **Account is taken from staged params, NOT `currentAccountNumber`.** The user may switch
   *    accounts between Continue and Confirm; we must always withdraw from the account that
   *    produced the `feeQuoteId`. Using `currentAccountNumber` would resolve the wrong wallet
   *    and either get rejected by the SSP or, worse, debit the wrong account.
   *
   * 3. **Persist before returning, atomically with success.** The reviewer pointed out that the
   *    previous version popped `pendingExits` and then called `withdraw()`: if the SDK promise
   *    rejected after the SSP had accepted, or if the caller's subsequent `commitTransfer` threw,
   *    the `coopExitRequestId` was lost and the user had no row to poll. We now persist inline
   *    after a successful SDK response and only delete `pendingExits` after persistence succeeds.
   *
   * 4. **Conservative cleanup on error.** Because the SDK does not expose an idempotency token at
   *    the public `withdraw()` surface, an SDK rejection is ambiguous — the SSP may or may not
   *    have committed. We pop `pendingExits` on error to prevent a second `withdraw()` that would
   *    create a duplicate cooperative exit. The user must re-quote to retry; if the first call
   *    actually succeeded server-side, the L1 broadcast will surface in their tx history shortly.
   */
  async executeInstantSwap(executionId: string): Promise<TransferExecution> {
    const params = this.pendingExits.get(executionId);
    if (!params) {
      throw new Error('No pending exit found for this execution. It may have expired or already been executed.');
    }
    if (this.inFlightExits.has(executionId)) {
      throw new Error('Withdrawal already in progress for this execution. Wait for it to settle before retrying.');
    }

    // Resolve the wallet for the *staged* account (invariant 2 above). Falling back to
    // `currentAccountNumber` would be a fund-safety bug if the user switched accounts mid-flow.
    const wallet = this.getSparkWallet(params.accountNumber);
    if (!wallet) {
      throw new Error(`Spark wallet for account ${params.accountNumber} is not initialized. Open that account first, then retry.`);
    }

    this.inFlightExits.add(executionId);
    try {
      // `exitSpeed` is a string-valued SDK enum (`ExitSpeed`). We don't import the enum at module
      // load because it would couple `shared/` to a Spark SDK subpath; the string value `'MEDIUM'`
      // is exactly what the SDK expects at runtime, so we cast at this single boundary.
      const coopExit = await wallet.withdraw({
        onchainAddress: params.onchainAddress,
        exitSpeed: params.exitSpeed as unknown as Parameters<SparkSDKWallet['withdraw']>[0]['exitSpeed'],
        amountSats: params.amountSats,
        feeQuoteId: params.feeQuoteId,
        feeAmountSats: params.feeAmountSats,
        // Fee deducted from withdrawal amount so the recipient gets `amountSats - feeAmountSats`,
        // which matches what we displayed as `receiveAmount` in the quote.
        deductFeeFromWithdrawalAmount: true,
      });

      if (!coopExit) {
        // SDK returned null — SSP rejected upfront, no funds moved. Safe to pop and surface.
        this.pendingExits.delete(executionId);
        throw new Error('Spark withdrawal failed: SSP returned no exit request');
      }

      const now = Math.floor(Date.now() / 1000);
      const execution: SparkExitExecution = {
        type: EXECUTION_SPARK_EXIT,
        id: executionId,
        status: mapSdkStatus(coopExit.status),
        sendAmount: params.sendAmount,
        receiveAmount: params.receiveAmount,
        sendAsset: params.sendAsset,
        receiveAsset: params.receiveAsset,
        createdAt: params.createdAt,
        updatedAt: now,
        settleAddress: params.onchainAddress,
        accountNumber: params.accountNumber,
        serviceName: this.name,
        coopExitRequestId: coopExit.id,
        coopExitTxid: coopExit.coopExitTxid || undefined,
        exitSpeed: params.exitSpeed,
      };

      // Persist BEFORE clearing pending and returning. If this throws after a successful
      // `withdraw()` the SDK has committed the funds — we log loudly so the lost `coopExitRequestId`
      // is at least visible in the device logs, and re-throw so the UI surfaces the failure.
      try {
        await this.commitTransfer(execution);
      } catch (persistErr) {
        console.error(`[SparkExit] CRITICAL: SDK withdraw succeeded (coopExitRequestId=${coopExit.id}) but persist failed. The withdrawal will still execute on L1.`, persistErr);
        this.pendingExits.delete(executionId);
        throw persistErr;
      }

      this.pendingExits.delete(executionId);
      return execution;
    } catch (e) {
      // Conservative cleanup: pop pending so a UI retry cannot trigger a second `withdraw()`.
      // See invariant 4 above. `pendingExits.delete` is idempotent so it's safe to call again
      // even if a more specific catch above already deleted.
      this.pendingExits.delete(executionId);
      throw e;
    } finally {
      this.inFlightExits.delete(executionId);
    }
  }

  async commitTransfer(execution: TransferExecution): Promise<void> {
    if (execution.type !== EXECUTION_SPARK_EXIT) return;
    const transfers = await this.loadTransfers();
    const idx = transfers.findIndex((t) => t.execution.id === execution.id);
    if (idx >= 0) {
      transfers[idx].execution = { ...transfers[idx].execution, ...execution };
    } else {
      transfers.push({ execution });
    }
    await this.saveTransfers(transfers);
  }

  async refreshTransferStatus(executionId: string, _accountNumber: number): Promise<TransferExecution> {
    const transfers = await this.loadTransfers();
    const entry = transfers.find((t) => t.execution.id === executionId);
    if (!entry) {
      throw new Error(`SparkExit transfer ${executionId} not found`);
    }
    const refreshed = await this.refreshOne(entry.execution);
    if (refreshed !== entry.execution) {
      entry.execution = refreshed;
      await this.saveTransfers(transfers);
    }
    return entry.execution;
  }

  async getOngoingTransfers(accountNumber: number): Promise<TransferExecution[]> {
    const transfers = await this.loadTransfers();
    const now = Math.floor(Date.now() / 1000);

    // Prune fully-terminal old transfers
    const active: SparkExitPersistedTransfer[] = [];
    for (const t of transfers) {
      if (isTerminalStatus(t.execution.status) && now - t.execution.createdAt > PRUNE_AGE_SECONDS) continue;
      active.push(t);
    }
    if (active.length !== transfers.length) {
      await this.saveTransfers(active);
    }

    // Opportunistically refresh non-terminal transfers for the active account.
    // We refresh inline so the UI sees fresh status without a separate polling layer.
    let changed = false;
    for (const t of active) {
      if (t.execution.accountNumber !== accountNumber) continue;
      if (isTerminalStatus(t.execution.status)) continue;
      try {
        const refreshed = await this.refreshOne(t.execution);
        if (refreshed !== t.execution) {
          t.execution = refreshed;
          changed = true;
        }
      } catch {
        // Network/SSP hiccup — leave status as-is and try next poll.
      }
    }
    if (changed) {
      await this.saveTransfers(active);
    }

    return active.filter((t) => t.execution.accountNumber === accountNumber).map((t) => t.execution);
  }

  getTimelineSteps(execution: TransferExecution): TimelineStep[] {
    if (execution.type !== EXECUTION_SPARK_EXIT) return [];
    const { status, createdAt, updatedAt, coopExitTxid } = execution;

    const step1Done = status === 'pending' || status === 'confirming' || status === 'completed' || isTerminalStatus(status);
    const step2Done = status === 'confirming' || status === 'completed';
    const step3Done = status === 'completed';

    return [
      {
        title: 'Exit initiated',
        description: 'Spark cooperative exit requested',
        status: step1Done ? 'completed' : 'active',
        timestamp: createdAt,
      },
      {
        title: 'Broadcasted to Bitcoin',
        description: coopExitTxid ? `L1 txid: ${coopExitTxid.slice(0, 12)}…` : 'Waiting for SSP to sign and broadcast',
        status: step3Done ? 'completed' : step2Done ? 'active' : 'upcoming',
        timestamp: step2Done ? updatedAt : undefined,
      },
      {
        title: 'Confirmed on Bitcoin',
        description: 'Funds settled on L1',
        status: step3Done ? 'completed' : 'upcoming',
        timestamp: step3Done ? updatedAt : undefined,
      },
    ];
  }

  getTrackingUrl(execution: TransferExecution): string | undefined {
    if (execution.type !== EXECUTION_SPARK_EXIT) return undefined;
    if (!execution.coopExitTxid) return undefined;
    const explorer = AllNetworkInfos[NETWORK_BITCOIN].explorerUrl;
    return `${explorer}/tx/${execution.coopExitTxid}`;
  }

  private async refreshOne(execution: SparkExitExecution): Promise<SparkExitExecution> {
    if (!execution.coopExitRequestId) return execution;
    const wallet = this.getSparkWallet(execution.accountNumber);
    if (!wallet) return execution; // wallet not initialized yet — caller will retry on next poll

    const req = await wallet.getCoopExitRequest(execution.coopExitRequestId);
    if (!req) return execution;

    const newStatus = mapSdkStatus(req.status);
    const newTxid = req.coopExitTxid || execution.coopExitTxid;
    if (newStatus === execution.status && newTxid === execution.coopExitTxid) {
      return execution;
    }
    return {
      ...execution,
      status: newStatus,
      coopExitTxid: newTxid || undefined,
      updatedAt: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Resolves the SDK wallet for the *currently active* account. Only safe to call from
   * `getQuote`, where the SDK fee quote must be bound to whichever account the user is on
   * right now. **Do NOT use from `executeInstantSwap`** — that codepath must resolve the
   * wallet from the staged `params.accountNumber` to avoid debiting the wrong account if
   * the user switches accounts between Continue and Confirm.
   */
  private requireWallet(): SparkSDKWallet {
    const wallet = this.getSparkWallet(this.currentAccountNumber);
    if (!wallet) {
      throw new Error('Spark wallet not initialized. Please open your Spark wallet first.');
    }
    return wallet;
  }

  private prunePendingQuotes(now: number): void {
    for (const [id, p] of this.pendingQuotes) {
      if (now - p.createdAt > PENDING_QUOTE_TTL) this.pendingQuotes.delete(id);
    }
  }

  private prunePendingExits(now: number): void {
    for (const [id, p] of this.pendingExits) {
      if (now - p.createdAt > PENDING_EXIT_TTL) this.pendingExits.delete(id);
    }
  }

  private async loadTransfers(): Promise<SparkExitPersistedTransfer[]> {
    const raw = await this.storage.getItem(STORAGE_KEY_SPARK_EXIT_TRANSFERS);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as SparkExitPersistedTransfer[];
    } catch {
      return [];
    }
  }

  private async saveTransfers(transfers: SparkExitPersistedTransfer[]): Promise<void> {
    await this.storage.setItem(STORAGE_KEY_SPARK_EXIT_TRANSFERS, JSON.stringify(transfers));
  }
}

/**
 * Reads a `CurrencyAmount` fee field as sats. We treat the value as sats, so the unit must be
 * SATOSHI — reading e.g. a BITCOIN-denominated value as sats understates the fee by 1e8 and
 * loses funds. Throw on a wrong unit or a missing field; both block the withdrawal, which is
 * the fund-safe failure mode (a `?? 0` default would silently underprice it).
 */
function feeAmountToSats(amount: CoopExitFeeQuote['userFeeMedium'] | undefined, label: string): number {
  if (!amount) {
    throw new Error(`Spark fee quote is missing the "${label}" field — cannot price the withdrawal.`);
  }
  if (String(amount.originalUnit) !== 'SATOSHI') {
    throw new Error(`Spark fee quote field "${label}" has unexpected unit "${String(amount.originalUnit)}" — expected SATOSHI. Refusing to withdraw to avoid mis-pricing the fee.`);
  }
  return Number(amount.originalValue);
}

/**
 * Quote expiry (epoch seconds) the UI counts down against. Use the SDK fee quote's own
 * `expiresAt` — the real binding deadline for `feeQuoteId` — instead of a fixed window, so the
 * countdown matches reality. Fall back to the staging TTL if it's missing/unparseable.
 */
function quoteExpiresAt(feeQuote: CoopExitFeeQuote, now: number): number {
  const parsed = Math.floor(new Date(feeQuote.expiresAt).getTime() / 1000);
  return Number.isFinite(parsed) ? parsed : now + PENDING_QUOTE_TTL;
}

/** Pulls the user-fee sats value (independent of L1 broadcast fee) from a CoopExitFeeQuote. */
function pickUserFee(feeQuote: CoopExitFeeQuote, speed: 'FAST' | 'MEDIUM' | 'SLOW'): number {
  switch (speed) {
    case 'FAST':
      return feeAmountToSats(feeQuote.userFeeFast, 'userFeeFast');
    case 'MEDIUM':
      return feeAmountToSats(feeQuote.userFeeMedium, 'userFeeMedium');
    case 'SLOW':
      return feeAmountToSats(feeQuote.userFeeSlow, 'userFeeSlow');
  }
}

/** Pulls the L1 broadcast fee sats value (independent of Spark userFee) from a CoopExitFeeQuote. */
function pickL1Fee(feeQuote: CoopExitFeeQuote, speed: 'FAST' | 'MEDIUM' | 'SLOW'): number {
  switch (speed) {
    case 'FAST':
      return feeAmountToSats(feeQuote.l1BroadcastFeeFast, 'l1BroadcastFeeFast');
    case 'MEDIUM':
      return feeAmountToSats(feeQuote.l1BroadcastFeeMedium, 'l1BroadcastFeeMedium');
    case 'SLOW':
      return feeAmountToSats(feeQuote.l1BroadcastFeeSlow, 'l1BroadcastFeeSlow');
  }
}

/**
 * Map `SparkCoopExitRequestStatus` to our internal `TransferStatus`.
 * - INITIATED / INBOUND_TRANSFER_CHECKED / TX_SIGNED → pending (SSP processing, no L1 broadcast yet)
 * - TX_BROADCASTED / WAITING_ON_TX_CONFIRMATIONS → confirming (L1 tx exists, waiting on confirmations)
 * - SUCCEEDED → completed
 * - EXPIRED / FAILED → terminal failure modes
 */
function mapSdkStatus(sdkStatus: CoopExitRequestStatus): TransferStatus {
  // `sdkStatus` is a string-valued SDK enum; widen to string so the literal `case`s compare
  // cleanly and the `default` still catches any FUTURE_VALUE the SDK adds.
  switch (String(sdkStatus)) {
    case 'SUCCEEDED':
      return 'completed';
    case 'TX_BROADCASTED':
    case 'WAITING_ON_TX_CONFIRMATIONS':
      return 'confirming';
    case 'EXPIRED':
      return 'expired';
    case 'FAILED':
      return 'failed';
    case 'INITIATED':
    case 'INBOUND_TRANSFER_CHECKED':
    case 'TX_SIGNED':
    default:
      return 'pending';
  }
}
