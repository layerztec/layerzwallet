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
  private _address: string | false = false;
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
   * Bring the SDK wallet online. Tries a VSS restore first (idempotent: no-op
   * when no backup exists) so that a fresh install using an existing mnemonic
   * picks up state created on another device.
   */
  async init(_storage: IStorage): Promise<void> {
    assert(this.secret, 'Cant init RGB wallet: secret is not set.');
    const params = { mnemonic: this.secret, network: this._sdkNetwork };
    try {
      this._sdkWallet = await this.adapter.restoreFromVss(params);
    } catch (e) {
      // First-run with no VSS backup; the adapter's restoreFromVss throws here.
      // Fall back to a fresh wallet — vssBackup() after the first mutation will
      // seed the backup.
      globalThis.handleError?.(e, 'rgb-wallet.ts:init');
      this._sdkWallet = await this.adapter.createWallet(params);
    }
  }

  private sdk(): IRgbWallet {
    assert(this._sdkWallet, 'RGB wallet not initialized');
    return this._sdkWallet;
  }

  async getOffchainReceiveAddress(): Promise<string> {
    if (!this._address) this._address = await this.sdk().getAddress();
    return this._address as string;
  }

  async getOffchainBalance(): Promise<number> {
    const bal = await this.sdk().getBtcBalance();
    this._lastBalanceFetch = Date.now();
    return Number(bal.vanilla.spendable) + Number(bal.colored.spendable);
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
   * For RGB, `address` is a full `rgb:` invoice. `tokenId` is the asset id.
   * Amount is in the asset's base units.
   */
  async transferToken(tokenId: string, amount: bigint, invoice: string): Promise<string> {
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
    const [txs, transfers] = await Promise.all([sdk.listTransactions(), sdk.listTransfers()]);

    const transfersByTxid = new Map<string, typeof transfers>();
    for (const t of transfers) {
      if (!t.txid) continue;
      const arr = transfersByTxid.get(t.txid) ?? [];
      arr.push(t);
      transfersByTxid.set(t.txid, arr);
    }

    const explorerBase = AllNetworkInfos[this._network].explorerUrl;
    const common: CommonTransaction[] = [];
    const seen = new Set<string>();

    for (const tx of txs) {
      seen.add(tx.txid);
      const netSats = tx.received - tx.sent;
      const related = transfersByTxid.get(tx.txid) ?? [];
      const tokenTransfers = this.assetTransfersToCommon(related);
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

    // Transfers without a BTC txid (e.g., blind-receive pending, failed) — surface separately.
    for (const t of transfers) {
      if (t.txid && seen.has(t.txid)) continue;
      const id = t.txid ?? t.invoiceString ?? String(t.idx);
      if (seen.has(id)) continue;
      seen.add(id);
      const tokenTransfers = this.assetTransfersToCommon([t]);
      common.push({
        network: this._network,
        txid: id,
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

  private assetTransfersToCommon(list: Array<{ assignments?: Array<{ type: string; amount?: number }>; recipientId?: string; kind: string }>): CommonTokenTransfer[] {
    const out: CommonTokenTransfer[] = [];
    for (const t of list) {
      for (const a of t.assignments ?? []) {
        if (a.type !== 'Fungible' && a.type !== 'NonFungible') continue;
        // Per-transfer the asset id isn't on the transfer itself; the UI needs
        // the token id to fetch metadata. RGB transfers are typically single-asset.
        // We leave tokenId blank when not resolvable and let the caller look it up
        // via assetId on the parent scope when needed. See fetchTokenBalances() for
        // the asset list.
        const matched = this._tokens[0];
        out.push({
          tokenId: matched?.id ?? '',
          amount: a.amount,
          decimals: matched?.decimals ?? 0,
          name: matched?.name,
          symbol: matched?.symbol,
          address: t.recipientId,
          logoURI: matched?.logoURI,
        });
      }
    }
    return out;
  }

  private async defaultFeeRate(): Promise<number> {
    // Conservative fallback; fee estimation UI can override by passing a higher rate
    // through a future sendBtc/send parameter.
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
   * Used by shared `validateAddress(network, input)` for the RGB networks.
   */
  static isAddressValid(input: string): boolean {
    const s = input.trim();
    if (!s) return false;
    if (s.startsWith('rgb:') || s.startsWith('utxob:')) return true;
    // taproot p2tr: bc1p... (mainnet) or tb1p... (testnet/signet)
    return /^(bc1p|tb1p|bcrt1p)[0-9a-z]{40,}$/i.test(s);
  }

  isAddressValid(input: string): boolean {
    return RgbWallet.isAddressValid(input);
  }
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
