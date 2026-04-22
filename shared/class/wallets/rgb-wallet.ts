import assert from 'assert';

import { AllNetworkInfos } from '../../models/all-network-infos';
import { CommonTokenTransfer, CommonTransaction } from '../../types/common-transaction';
import { Networks, NETWORK_RGB, NETWORK_RGB_TESTNET } from '../../types/networks';
import { CachedTokenInfo } from '../../types/token-info';
import { IRgbAdapter, IRgbWallet, RgbNetwork } from '../../types/rgb-adapter';
import { IStorage } from '../../types/IStorage';
import { AbstractWallet } from './abstract-wallet';
import { InterfaceAccountBasedWallet } from './interface-account-based-wallet';
import { InterfaceCanHaveTokens } from './interface-can-have-tokens';

type AnyAsset = {
  assetId: string;
  ticker?: string;
  name: string;
  precision: number;
  balance: { settled: number; future: number; spendable: number };
  media?: { filePath?: string; mime?: string } | null;
};

type SdkTransfer = Awaited<ReturnType<IRgbWallet['listTransfers']>>[number];
type AnnotatedTransfer = SdkTransfer & { assetId?: string };

export class RgbWallet extends AbstractWallet implements InterfaceAccountBasedWallet, InterfaceCanHaveTokens {
  static readonly type = 'rgb';
  static readonly typeReadable = 'RGB';
  // @ts-ignore: override
  public readonly type = RgbWallet.type;
  // @ts-ignore: override
  public readonly typeReadable = RgbWallet.typeReadable;

  protected adapter: IRgbAdapter;
  private readonly _network: Networks;
  private readonly _sdkNetwork: RgbNetwork;
  private _accountNumber: number = 0;
  private _sdkWallet: IRgbWallet | undefined;
  private _tokens: CachedTokenInfo[] = [];
  private _receiveAddress: string | undefined;
  public _lastTokensFetch: number = 0;
  /** Dedupes concurrent `fetchTokenBalances` calls from different hooks. */
  private _tokensFetchInFlight: Promise<void> | undefined;

  constructor(network: Networks = NETWORK_RGB) {
    super();
    assert(network === NETWORK_RGB || network === NETWORK_RGB_TESTNET, `Unsupported RGB network: ${network}`);
    this._network = network;
    this._sdkNetwork = network === NETWORK_RGB_TESTNET ? 'testnet' : 'mainnet';
    assert(globalThis.rgbAdapter, 'RGB adapter not installed on globalThis.rgbAdapter');
    this.adapter = globalThis.rgbAdapter;
  }

  setAccountNumber(n: number): void {
    this._accountNumber = n;
  }

  getAccountNumber(): number {
    return this._accountNumber;
  }

  getNetwork(): Networks {
    return this._network;
  }

  /**
   * Bring the SDK wallet online. Tries a VSS restore first so a fresh install
   * with an existing mnemonic picks up state created on another device. Any
   * "backup not found" signal falls through to a fresh wallet; any other error
   * rethrows so we don't silently overwrite remote backups with an empty
   * local state on the next mutation.
   */
  async init(_storage: IStorage): Promise<void> {
    assert(this.secret, 'Cant init RGB wallet: secret is not set.');
    const params = { mnemonic: this.secret, network: this._sdkNetwork };
    try {
      this._sdkWallet = await this.adapter.restoreFromVss(params);
      return;
    } catch (e) {
      if (!isVssBackupMissing(e)) {
        globalThis.handleError?.(e, 'rgb-wallet.ts:init:vss');
        throw e;
      }
    }
    this._sdkWallet = await this.adapter.createWallet(params);
  }

  private sdk(): IRgbWallet {
    assert(this._sdkWallet, 'RGB wallet not initialized');
    return this._sdkWallet;
  }

  async getOffchainReceiveAddress(): Promise<string> {
    if (!this._receiveAddress) this._receiveAddress = await this.sdk().getAddress();
    return this._receiveAddress;
  }

  /**
   * Returns the spendable **vanilla** BTC balance. Colored sats (the 1000-sat
   * commitment outputs bound to each RGB allocation) are excluded: the user
   * can't actually spend them as BTC without destroying an asset allocation.
   *
   * Kicks off an opportunistic asset-list refresh but does not await it — a
   * transient indexer failure on the asset side must not fail the BTC balance.
   */
  async getOffchainBalance(): Promise<number> {
    const bal = await this.sdk().getBtcBalance();
    this._lastBalanceFetch = Date.now();
    this.fetchTokenBalances().catch((e) => globalThis.handleError?.(e, 'rgb-wallet.ts:fetchTokens'));
    return Number(bal.vanilla.spendable);
  }

  async pay(receiverAddress: string, amountSats: number): Promise<string> {
    const txid = await this.sdk().sendBtc({
      address: receiverAddress,
      amount: amountSats,
      feeRate: await this.defaultFeeRate(),
    });
    await this.tryBackup();
    return txid;
  }

  /**
   * `invoice` must be a full `rgb:`/`utxob:` invoice. `tokenId` is the RGB asset id.
   * Amount is in the asset's base units; the `_memo` parameter is accepted to
   * satisfy InterfaceCanHaveTokens but is ignored — the RGB send API has no memo
   * field.
   */
  async transferToken(tokenId: string, amount: bigint, invoice: string, _memo?: string): Promise<string> {
    // The SDK's send API takes `amount: number`. High-precision assets (e.g.
    // precision 18 + a large holding) can exceed JS's safe-integer range; the
    // error surfaces here rather than producing a silently rounded send.
    assert(amount <= BigInt(Number.MAX_SAFE_INTEGER), `RGB send amount ${amount} exceeds Number.MAX_SAFE_INTEGER (2^53). ` + 'Reduce the amount or wait for SDK bigint support.');
    const result = await this.sdk().send({
      invoice,
      assetId: tokenId,
      amount: Number(amount),
      feeRate: await this.defaultFeeRate(),
    });
    await this.tryBackup();
    return result.txid;
  }

  async fetchTokenBalances(): Promise<void> {
    // Dedupes concurrent callers (useBalance + useTransactions + useTokenDiscovery
    // can all fire at once on cold start) and returns the same in-flight promise.
    if (this._tokensFetchInFlight) return this._tokensFetchInFlight;
    this._tokensFetchInFlight = (async () => {
      try {
        const list = await this.sdk().listAssets();
        const assets: AnyAsset[] = [...(list.nia ?? []), ...(list.cfa ?? []), ...(list.ifa ?? []), ...(list.uda ?? [])];
        this._tokens = assets.map((a) => ({
          id: a.assetId,
          chainId: AllNetworkInfos[this._network].chainId,
          name: a.name,
          symbol: a.ticker ?? a.name,
          decimals: a.precision,
          balance: String(a.balance.spendable),
          logoURI: a.media?.filePath,
        }));
        this._lastTokensFetch = Date.now();
      } finally {
        this._tokensFetchInFlight = undefined;
      }
    })();
    return this._tokensFetchInFlight;
  }

  getTokenBalances(): CachedTokenInfo[] {
    return this._tokens;
  }

  async getCommonTransactions(): Promise<CommonTransaction[]> {
    const sdk = this.sdk();
    // Get on-chain tx metadata (fee, confirmation) and per-asset transfers.
    // `listTransfers()` without an assetId yields transfers with no asset id
    // attached, which is useless for UI attribution — we iterate the known
    // assets and annotate each transfer with its assetId at the source.
    const [txs, assetIds] = await Promise.all([sdk.listTransactions(), this.knownAssetIds()]);
    const perAssetTransfers = await Promise.all(assetIds.map(async (aid) => (await sdk.listTransfers(aid)).map((t) => ({ ...t, assetId: aid }) as AnnotatedTransfer)));
    const transfers: AnnotatedTransfer[] = perAssetTransfers.flat();

    const transfersByTxid = new Map<string, AnnotatedTransfer[]>();
    for (const t of transfers) {
      if (!t.txid) continue;
      const arr = transfersByTxid.get(t.txid) ?? [];
      arr.push(t);
      transfersByTxid.set(t.txid, arr);
    }

    const explorerBase = AllNetworkInfos[this._network].explorerUrl;
    const common: CommonTransaction[] = [];
    const seenTxids = new Set<string>();
    const seenTransferIds = new Set<string>();

    for (const tx of txs) {
      seenTxids.add(tx.txid);
      const netSats = tx.received - tx.sent;
      const related = transfersByTxid.get(tx.txid) ?? [];
      const tokenTransfers = this.annotatedTransfersToCommon(related);
      const direction: CommonTransaction['direction'] = netSats === 0 && tokenTransfers.length > 0 ? (related.some((r) => r.kind === 'Send') ? 'send' : 'receive') : netSats > 0 ? 'receive' : 'send';
      common.push({
        network: this._network,
        txid: tx.txid,
        timestamp: tx.confirmationTime?.timestamp ?? Math.floor(Date.now() / 1000),
        direction,
        amount: Math.abs(netSats),
        fee: tx.fee,
        status: tx.confirmationTime ? 'confirmed' : 'pending',
        blockHeight: tx.confirmationTime?.height,
        tokenTransfers: tokenTransfers.length > 0 ? tokenTransfers : undefined,
        explorerUrl: explorerBase ? `${explorerBase}/tx/${tx.txid}` : undefined,
      });
    }

    // Pending / failed transfers without a mined txid (blind-receive awaiting
    // counterparty, etc.) — surface separately, keyed in a distinct namespace
    // so we can't collide with raw txids.
    for (const t of transfers) {
      if (t.txid && seenTxids.has(t.txid)) continue;
      const key = `transfer:${t.txid ?? t.invoiceString ?? `idx-${t.idx}`}`;
      if (seenTransferIds.has(key)) continue;
      seenTransferIds.add(key);
      const tokenTransfers = this.annotatedTransfersToCommon([t]);
      common.push({
        network: this._network,
        txid: t.txid ?? key,
        timestamp: Math.floor((t.updatedAt || t.createdAt) / 1000),
        direction: t.kind === 'Send' ? 'send' : 'receive',
        status: transferStatusToCommon(t.status),
        tokenTransfers: tokenTransfers.length > 0 ? tokenTransfers : undefined,
        explorerUrl: explorerBase && t.txid ? `${explorerBase}/tx/${t.txid}` : undefined,
      });
    }

    common.sort((a, b) => b.timestamp - a.timestamp);
    return common;
  }

  /**
   * Returns asset ids known to the wallet. Populates `_tokens` as a side effect
   * if the cache is empty, so that transfer attribution has metadata to join
   * against.
   */
  private async knownAssetIds(): Promise<string[]> {
    if (this._tokens.length === 0) await this.fetchTokenBalances();
    return this._tokens.map((t) => t.id);
  }

  private annotatedTransfersToCommon(list: AnnotatedTransfer[]): CommonTokenTransfer[] {
    const out: CommonTokenTransfer[] = [];
    // Dedupe against the case where the SDK returns the same transfer (same
    // assignments) for multiple per-asset `listTransfers(aid)` calls — e.g. a
    // batch transfer that touches two assets might surface in both queries.
    // Keying by (tokenId, amount, recipientId, kind) collapses exact repeats
    // without masking legitimately-distinct assignments.
    const seen = new Set<string>();
    for (const t of list) {
      const metadata = t.assetId ? this._tokens.find((m) => m.id === t.assetId) : undefined;
      for (const a of t.assignments ?? []) {
        if (a.type !== 'Fungible' && a.type !== 'NonFungible') continue;
        const key = `${t.assetId ?? ''}|${a.amount ?? ''}|${t.recipientId ?? ''}|${t.kind}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          tokenId: t.assetId ?? '',
          amount: a.amount,
          decimals: metadata?.decimals ?? 0,
          name: metadata?.name,
          symbol: metadata?.symbol,
          address: t.recipientId,
          logoURI: metadata?.logoURI,
        });
      }
    }
    return out;
  }

  private async defaultFeeRate(): Promise<number> {
    return this._sdkNetwork === 'testnet' ? 1 : 5;
  }

  private async tryBackup(): Promise<void> {
    try {
      await this.sdk().vssBackup();
    } catch (e) {
      globalThis.handleError?.(e, 'rgb-wallet.ts:vssBackup');
    }
  }

  /**
   * Cheap shape check: confirms the string *looks* like an RGB invoice or a
   * taproot address so we don't submit obvious garbage to the SDK. Deep
   * validation (invoice consistency, transport endpoint reachability,
   * checksum) happens inside `sdk().decodeRGBInvoice()` and bech32m decoding
   * at send time — there's no value in duplicating that here.
   */
  static isAddressValid(input: string): boolean {
    const s = input.trim();
    if (!s) return false;
    // RGB invoices: require the scheme prefix plus a reasonably-long payload.
    // Invoice payloads can contain any base64url-like or URL-safe chars
    // depending on encoding, so the permissive payload check is intentional.
    if (/^rgb:\S{10,}$/i.test(s)) return true;
    if (/^utxob:\S{10,}$/i.test(s)) return true;
    // Taproot p2tr: bc1p / tb1p / bcrt1p bech32m.
    return /^(bc1p|tb1p|bcrt1p)[0-9a-z]{40,}$/i.test(s);
  }

  isAddressValid(input: string): boolean {
    return RgbWallet.isAddressValid(input);
  }
}

function isVssBackupMissing(e: unknown): boolean {
  // Only treat "VSS has no backup for this mnemonic" as an expected path into
  // fresh-wallet creation. Every other error rethrows so we never silently
  // overwrite a real remote backup with an empty local state.
  //
  // Each platform SDK signals this differently:
  //  • RN SDK throws an RgbError with `code === 'VssBackupNotFound'` and a
  //    message like `Rgb.RgbLibError.VssBackupNotFound`.
  //  • Web SDK throws a non-Error object whose `toString()` returns
  //    `"VSS backup not found"` — no `message` property, just a stringifier.
  //  • Node/HTTP paths tend to throw a NotFoundError or an HTTP 404.
  // We check all of them so existing users (no RGB state yet) get a fresh
  // wallet on first unlock rather than a retry-loop error.
  if (!e) return false;
  const err = e as { name?: string; message?: string; statusCode?: number; status?: number; code?: string };
  if (err.code === 'VssBackupNotFound') return true;
  if (err.name === 'NotFoundError') return true;
  if (err.statusCode === 404 || err.status === 404) return true;
  const text = typeof err.message === 'string' ? err.message : String(e);
  if (/VssBackupNotFound|backup\s*not\s*found|backup\s+(does\s+not\s+exist|missing)/i.test(text)) return true;
  return false;
}

function transferStatusToCommon(status: string): CommonTransaction['status'] {
  switch (status) {
    case 'Settled':
      return 'confirmed';
    case 'Failed':
      return 'failed';
    case 'WaitingCounterparty':
    case 'WaitingConfirmations':
    default:
      return 'pending';
  }
}
