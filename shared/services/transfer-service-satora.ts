import { Client, type GetSwapResponse, type LightningToEvmSwapResponse, type SwapStatus } from '@lendasat/lendaswap-sdk-pure';
import BigNumber from 'bignumber.js';

import { IStorage, STORAGE_KEY_SATORA_SWAPS } from '../types/IStorage';
import type { AssetId } from '../types/asset';
import { EXECUTION_DEPOSIT, ITransferService, isTerminalStatus, TimelineStep, TransferExecution, TransferPair, TransferQuote, TransferStatus } from '../types/transfer';
import { SatoraSwapStorageAdapter, SatoraWalletStorageAdapter } from './satora-storage-adapter';

const PRUNE_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days
const QUOTE_TTL_SECONDS = 60; // 1 minute
const SATORA_BASE_URL = 'https://api.lendaswap.com';
const SDK_GETSWAP_TIMEOUT_MS = 10_000;

const USDT0_ROOTSTOCK_ADDR = '0x779dED0C9e1022225F8e0630b35A9B54Be713736';
const ROOTSTOCK_CHAIN_ID = '30';
const USDT0_DECIMALS = 6;
const BTC_DECIMALS = 8;

const SEND_ASSET: AssetId = 'native:lightning';
const RECEIVE_ASSET: AssetId = 'token:rootstock:usdt0';

interface PersistedTransfer {
  execution: TransferExecution;
  satoraSwapId: string;
  /** Rootstock address captured at create time — where USDT0 lands. Informational: `client.claim`
   *  reads the destination from the SDK's own swap storage, so we don't re-pass it. */
  rootstockTargetAddress: string;
  /** Whether we've already fired `client.claim(id)` for this swap. Idempotency guard against
   *  multiple pollers double-claiming. */
  claimCalled: boolean;
}

/**
 * Satora Swaps provider.
 *
 * v1 supports a single direction: BTC on Lightning → USDT0 on Rootstock.
 *
 * Flow:
 * 1. `createSwap({source: Lightning, target: USDT0@Rootstock, gasless: true})` returns a BOLT11 invoice.
 *    The Satora SDK detects that Rootstock is a bridge-only chain (LayerZero USDT0 OFT) and
 *    transparently remaps the DEX swap to Arbitrum + sets `bridgeParams` so the server bridges
 *    the output to Rootstock.
 * 2. The wallet's confirm screen pays the BOLT11 from a user-picked internal LN wallet
 *    (BreezWallet / SparkWallet / ArkWallet — all implement `InterfaceLightningWallet`).
 * 3. Satora server detects the payment, executes the DEX swap on Arbitrum, bridges USDT0
 *    via LayerZero OFT to Rootstock, and delivers to the user's Rootstock address.
 * 4. We just poll `getSwap(id)` until terminal — no client-side claim/relay action required.
 *
 * Docs: https://docs.satora.io/
 * SDK:  https://www.npmjs.com/package/@lendasat/lendaswap-sdk-pure
 */
export class SatoraTransferService implements ITransferService {
  readonly name = 'Satora';

  private clientPromise?: Promise<Client>;
  private readonly storage: IStorage;
  private readonly apiKey: string | undefined;
  private readonly walletStorage: SatoraWalletStorageAdapter;
  private readonly swapStorage: SatoraSwapStorageAdapter;
  private readonly uncommitted = new Map<string, TransferExecution>();

  constructor(storage: IStorage, apiKey?: string) {
    this.storage = storage;
    this.apiKey = apiKey && apiKey.length > 0 ? apiKey : undefined;
    this.walletStorage = new SatoraWalletStorageAdapter(storage);
    this.swapStorage = new SatoraSwapStorageAdapter(storage);
  }

  private getClient(): Promise<Client> {
    if (!this.clientPromise) {
      let builder = Client.builder().withSignerStorage(this.walletStorage).withSwapStorage(this.swapStorage).withBaseUrl(SATORA_BASE_URL);
      if (this.apiKey) {
        builder = builder.withApiKey(this.apiKey);
      }
      this.clientPromise = builder.build().catch((e) => {
        this.clientPromise = undefined;
        throw e;
      });
    }
    return this.clientPromise;
  }

  getSupportedPairs(): TransferPair[] {
    return [{ sendAssetId: SEND_ASSET, receiveAssetId: RECEIVE_ASSET }];
  }

  async getQuote(sendAsset: AssetId, receiveAsset: AssetId, sendAmount: string): Promise<TransferQuote> {
    if (sendAsset !== SEND_ASSET) {
      throw new Error(`Satora only supports ${SEND_ASSET} as send asset (got ${sendAsset})`);
    }
    if (receiveAsset !== RECEIVE_ASSET) {
      throw new Error(`Satora only supports ${RECEIVE_ASSET} as receive asset (got ${receiveAsset})`);
    }

    const sats = new BigNumber(sendAmount).multipliedBy(new BigNumber(10).pow(BTC_DECIMALS)).integerValue(BigNumber.ROUND_DOWN);
    if (!sats.isFinite() || sats.lte(0)) {
      throw new Error('Invalid send amount');
    }
    if (!sats.isLessThan(Number.MAX_SAFE_INTEGER)) {
      throw new Error('Amount too large for Satora quote');
    }

    const client = await this.getClient();
    const quote = await client.getQuote({
      sourceChain: 'Lightning',
      sourceToken: 'btc',
      // SDK declares Chain as a narrow union that omits Rootstock's '30',
      // but the runtime dispatcher (`client.ts` → `isBridgeOnlyChain`) accepts it
      // and transparently bridges via LayerZero USDT0 after DEX-swapping on Arbitrum.
      targetChain: ROOTSTOCK_CHAIN_ID as unknown as 'Lightning',
      targetToken: USDT0_ROOTSTOCK_ADDR,
      sourceAmount: sats.toNumber(),
    });

    // target_amount is in USDT0 smallest units (6 decimals).
    const receiveAmount = new BigNumber(quote.target_amount).dividedBy(new BigNumber(10).pow(USDT0_DECIMALS)).toFixed(USDT0_DECIMALS);

    // Fee is denominated in sats (BTC side). Sum protocol/network/gasless fees plus optional bridge_fee.
    // Note: bridge_fee is reported in USDC smallest units (6 decimals) per the SDK OpenAPI spec —
    // we surface only the sat-denominated fees here for display simplicity.
    const totalFeeSats = new BigNumber(quote.protocol_fee).plus(quote.network_fee).plus(quote.gasless_network_fee);
    const feeBtc = totalFeeSats.dividedBy(new BigNumber(10).pow(BTC_DECIMALS)).toFixed(BTC_DECIMALS);

    // Display rate as "1 BTC = X USDT0" for clarity.
    const btcAmount = sats.dividedBy(new BigNumber(10).pow(BTC_DECIMALS));
    const usdt0Amount = new BigNumber(receiveAmount);
    const usdt0PerBtc = btcAmount.gt(0) ? usdt0Amount.dividedBy(btcAmount).toFixed(2) : '0';

    const now = Math.floor(Date.now() / 1000);
    return {
      id: `satora-quote-${now}-${Math.random().toString(36).slice(2, 8)}`,
      sendAsset,
      receiveAsset,
      sendAmount,
      receiveAmount,
      rate: `1 BTC = ${usdt0PerBtc} USDT0`,
      fee: feeBtc,
      feeTicker: 'BTC',
      estimatedTime: 300,
      expiresAt: now + QUOTE_TTL_SECONDS,
      serviceName: this.name,
    };
  }

  async executeTransfer(quote: TransferQuote, accountNumber: number, settleAddress: string): Promise<TransferExecution> {
    if (Date.now() / 1000 > quote.expiresAt) {
      throw new Error('Quote has expired. Please get a new quote.');
    }
    if (quote.sendAsset !== SEND_ASSET || quote.receiveAsset !== RECEIVE_ASSET) {
      throw new Error(`Satora does not support ${quote.sendAsset} → ${quote.receiveAsset}`);
    }
    if (!settleAddress || !settleAddress.toLowerCase().startsWith('0x')) {
      throw new Error('Satora requires a Rootstock EVM address as the settle address');
    }

    const sats = new BigNumber(quote.sendAmount).multipliedBy(new BigNumber(10).pow(BTC_DECIMALS)).integerValue(BigNumber.ROUND_DOWN);
    if (!sats.isFinite() || sats.lte(0)) {
      throw new Error('Invalid send amount');
    }
    if (!sats.isLessThan(Number.MAX_SAFE_INTEGER)) {
      throw new Error('Amount too large for Satora swap');
    }

    const client = await this.getClient();
    const result = await client.createSwap({
      source: { chain: 'Lightning', tokenId: 'btc' },
      target: { chain: ROOTSTOCK_CHAIN_ID, tokenId: USDT0_ROOTSTOCK_ADDR },
      targetAddress: settleAddress,
      sourceAmount: sats.toNumber(),
      gasless: true,
    });

    const response = result.response as LightningToEvmSwapResponse;
    if (!('bolt11_invoice' in response) || !response.bolt11_invoice) {
      throw new Error('Satora response missing BOLT11 invoice');
    }

    const now = Math.floor(Date.now() / 1000);
    const execution: TransferExecution = {
      type: EXECUTION_DEPOSIT,
      id: response.id,
      providerId: response.id,
      status: mapSatoraStatus(response.status),
      sendAmount: quote.sendAmount,
      receiveAmount: quote.receiveAmount,
      sendAsset: quote.sendAsset,
      receiveAsset: quote.receiveAsset,
      depositAddress: response.bolt11_invoice, // What the user's LN wallet pays
      settleAddress, // Rootstock address (where USDT0 lands)
      createdAt: now,
      updatedAt: now,
      accountNumber,
      serviceName: this.name,
    };

    this.uncommitted.set(execution.id, execution);
    return execution;
  }

  async commitTransfer(execution: TransferExecution): Promise<void> {
    const transfers = await this.loadTransfers();
    const existingIdx = transfers.findIndex((t) => t.execution.id === execution.id);
    if (existingIdx >= 0) {
      transfers[existingIdx].execution = { ...transfers[existingIdx].execution, ...execution };
      await this.saveTransfers(transfers);
      return;
    }

    const uncommitted = this.uncommitted.get(execution.id) ?? execution;
    if (!execution.settleAddress) {
      throw new Error('Cannot commit Satora transfer without a Rootstock destination address');
    }
    transfers.push({
      execution: { ...uncommitted, ...execution },
      satoraSwapId: execution.providerId ?? execution.id,
      rootstockTargetAddress: execution.settleAddress,
      claimCalled: false,
    });
    await this.saveTransfers(transfers);
    this.uncommitted.delete(execution.id);
  }

  async getOngoingTransfers(accountNumber: number): Promise<TransferExecution[]> {
    const transfers = await this.loadTransfers();
    const now = Math.floor(Date.now() / 1000);
    const active: PersistedTransfer[] = [];
    let client: Client | undefined;

    for (const t of transfers) {
      if (isTerminalStatus(t.execution.status) && now - t.execution.createdAt > PRUNE_AGE_SECONDS) {
        continue;
      }

      if (!isTerminalStatus(t.execution.status)) {
        try {
          if (!client) client = await this.getClient();
          const swap = await withTimeout(client.getSwap(t.satoraSwapId), SDK_GETSWAP_TIMEOUT_MS);
          t.execution.status = mapSatoraStatus(swap.status);
          t.execution.updatedAt = now;

          // Once the Satora server has funded the EVM HTLC (serverfunded), the client must
          // call `client.claim(swapId)` to trigger `coordinator.redeemAndExecute` — which
          // runs the DEX swap on Arbitrum and bridges USDT0 to Rootstock via LayerZero OFT.
          // The SDK reads the stored swap from SatoraSwapStorageAdapter, extracts the
          // target Rootstock address, and internally calls `claimViaGasless`.
          // Idempotency via `claimCalled`; retry on thrown errors or `success: false`.
          if (!t.claimCalled && shouldTriggerClaim(swap.status)) {
            try {
              const result = await client.claim(t.satoraSwapId);
              if (result.success) {
                t.claimCalled = true;
              } else {
                console.warn(`Satora claim reported failure for ${t.satoraSwapId}: ${result.message}`);
                // Leave flag false → retry next poll.
              }
            } catch (e) {
              console.warn(`Satora claim threw for ${t.satoraSwapId}: ${(e as Error).message}`);
              // Leave flag false → retry next poll.
            }
          }
        } catch (e) {
          console.warn(`Failed to poll Satora swap ${t.satoraSwapId}: ${(e as Error).message}`);
        }
      }

      active.push(t);
    }

    await this.saveTransfers(active);
    return active.filter((t) => t.execution.accountNumber === accountNumber).map((t) => t.execution);
  }

  async refreshTransferStatus(executionId: string, _accountNumber: number): Promise<TransferExecution> {
    const transfers = await this.loadTransfers();
    const transfer = transfers.find((t) => t.execution.id === executionId);
    if (!transfer) {
      throw new Error(`Satora transfer ${executionId} not found`);
    }
    const client = await this.getClient();
    const swap = await client.getSwap(transfer.satoraSwapId);
    transfer.execution.status = mapSatoraStatus(swap.status);
    transfer.execution.updatedAt = Math.floor(Date.now() / 1000);

    // Same auto-claim logic as getOngoingTransfers — if the user is watching
    // the details screen when the swap hits serverfunded, trigger the claim
    // here too so it doesn't stall.
    if (!transfer.claimCalled && shouldTriggerClaim(swap.status)) {
      try {
        const result = await client.claim(transfer.satoraSwapId);
        if (result.success) {
          transfer.claimCalled = true;
        } else {
          console.warn(`Satora claim reported failure for ${transfer.satoraSwapId}: ${result.message}`);
        }
      } catch (e) {
        console.warn(`Satora claim threw for ${transfer.satoraSwapId}: ${(e as Error).message}`);
      }
    }

    await this.saveTransfers(transfers);
    return transfer.execution;
  }

  getTimelineSteps(execution: TransferExecution): TimelineStep[] {
    return getSatoraTimelineSteps(execution);
  }

  getTrackingUrl(_execution: TransferExecution): string | undefined {
    return undefined;
  }

  private async loadTransfers(): Promise<PersistedTransfer[]> {
    const raw = await this.storage.getItem(STORAGE_KEY_SATORA_SWAPS + '_TRANSFERS');
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as PersistedTransfer[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async saveTransfers(transfers: PersistedTransfer[]): Promise<void> {
    await this.storage.setItem(STORAGE_KEY_SATORA_SWAPS + '_TRANSFERS', JSON.stringify(transfers));
  }
}

export function mapSatoraStatus(status: SwapStatus): TransferStatus {
  switch (status) {
    case 'pending':
      return 'waiting';
    case 'clientfundingseen':
      return 'confirming';
    case 'clientfunded':
      // LN paid, server dispatching DEX + LayerZero bridge to Rootstock.
      return 'pending';
    case 'serverfunded':
      // Bridge in-flight.
      return 'pending';
    case 'clientredeeming':
      return 'pending';
    case 'clientredeemed':
    case 'serverredeemed':
      // USDT0 delivered to the user's Rootstock address.
      return 'completed';
    case 'clientrefunded':
    case 'clientfundedserverrefunded':
    case 'clientrefundedserverfunded':
    case 'clientrefundedserverrefunded':
    case 'clientredeemedandclientrefunded':
      return 'refunded';
    case 'expired':
    case 'clientfundedtoolate':
      return 'expired';
    case 'clientinvalidfunded':
      return 'failed';
    default:
      return 'failed';
  }
}

/**
 * Whether Satora's status indicates the server has funded the EVM HTLC and we should
 * call `client.claim(swapId)` to trigger the server-side redeem + DEX + bridge.
 * Only fires on `serverfunded`; after the SDK's claim call the status advances
 * `serverfunded → clientredeeming → clientredeemed`.
 */
export function shouldTriggerClaim(status: SwapStatus): boolean {
  return status === 'serverfunded';
}

/** 4-step timeline for Satora Lightning → USDT0 on Rootstock. */
export function getSatoraTimelineSteps(execution: TransferExecution): TimelineStep[] {
  const { status, createdAt, updatedAt } = execution;
  const now = Math.floor(Date.now() / 1000);

  if (status === 'expired') {
    return [
      { title: 'Swap Created', description: 'Waiting for Lightning payment', status: 'completed', timestamp: createdAt },
      { title: 'Expired', description: 'Invoice was not paid in time', status: 'error', timestamp: updatedAt },
    ];
  }

  const step1: TimelineStep = {
    title: 'Pay Invoice',
    description: 'Lightning invoice issued',
    status: status === 'waiting' ? 'active' : 'completed',
    timestamp: createdAt,
  };

  const step2Active = status === 'confirming';
  const step2: TimelineStep = {
    title: 'Payment Detected',
    description: 'Lightning payment received',
    status: status === 'waiting' ? 'upcoming' : step2Active ? 'active' : 'completed',
    timestamp: step2Active ? now : undefined,
  };

  const step3Active = status === 'pending';
  const isTerminalNonExpired = status === 'completed' || status === 'refunded' || status === 'failed';
  const step3: TimelineStep = {
    title: 'Bridge to Rootstock',
    description: 'DEX swap + LayerZero USDT0 bridge',
    status: status === 'waiting' || status === 'confirming' ? 'upcoming' : isTerminalNonExpired ? 'completed' : step3Active ? 'active' : 'upcoming',
    timestamp: step3Active ? now : undefined,
  };

  const isTerminal = isTerminalStatus(status);
  const finalTitle = status === 'failed' ? 'Failed' : status === 'refunded' ? 'Refunded' : 'USDT0 Received';
  const finalDesc = status === 'failed' ? 'The swap could not be completed' : status === 'refunded' ? 'Funds have been returned' : 'USDT0 delivered to your Rootstock wallet';
  const step4: TimelineStep = {
    title: finalTitle,
    description: finalDesc,
    status: isTerminal ? (status === 'failed' ? 'error' : 'completed') : 'upcoming',
    timestamp: isTerminal ? updatedAt : undefined,
  };

  return [step1, step2, step3, step4];
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Satora request timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export type { GetSwapResponse };
