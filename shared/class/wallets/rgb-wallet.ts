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
   */
  async getOffchainBalance(): Promise<number> {
    const [bal] = await Promise.all([this.sdk().getBtcBalance(), this.fetchTokenBalances()]);
    this._lastBalanceFetch = Date.now();
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
    assert(amount <= BigInt(Number.MAX_SAFE_INTEGER), 'RGB send amount exceeds 2^53 — not representable as JS number');
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
    for (const t of list) {
      const metadata = t.assetId ? this._tokens.find((m) => m.id === t.assetId) : undefined;
      for (const a of t.assignments ?? []) {
        if (a.type !== 'Fungible' && a.type !== 'NonFungible') continue;
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
   * Validates either a Bitcoin taproot address or an `rgb:`/`utxob:` invoice.
   * The invoice shape check requires at least some payload after the scheme
   * prefix — we leave deep decoding to `sdk().decodeRGBInvoice()` at send time.
   */
  static isAddressValid(input: string): boolean {
    const s = input.trim();
    if (!s) return false;
    if (/^rgb:[a-zA-Z0-9:_+$-]{10,}$/i.test(s)) return true;
    if (/^utxob:[a-zA-Z0-9$!+_-]{10,}$/i.test(s)) return true;
    // taproot p2tr: bc1p... / tb1p... / bcrt1p...
    return /^(bc1p|tb1p|bcrt1p)[0-9a-z]{40,}$/i.test(s);
  }

  isAddressValid(input: string): boolean {
    return RgbWallet.isAddressValid(input);
  }
}

function isVssBackupMissing(e: unknown): boolean {
  // The SDK raises a NotFoundError (or wraps an HTTP 404) when the VSS bucket
  // has no backup for this mnemonic yet. Matching by name — rather than
  // `instanceof` — keeps us resilient to core version drift.
  if (!e) return false;
  const err = e as { name?: string; message?: string; statusCode?: number };
  if (err.name === 'NotFoundError') return true;
  if (err.statusCode === 404) return true;
  if (typeof err.message === 'string' && /not.?found|no.?backup|does not exist/i.test(err.message)) return true;
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
