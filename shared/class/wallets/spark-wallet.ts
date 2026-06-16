import { encodeBech32mTokenIdentifier, encodeSparkAddress, isValidSparkAddress, SparkWallet as SDK, TokenBalanceMap } from '@buildonspark/spark-sdk';
import assert from 'assert';
import BigNumber from 'bignumber.js';
import bolt11 from 'bolt11';

import * as BlueElectrum from '../../blue_modules/BlueElectrum';
import { AllNetworkInfos } from '../../models/all-network-infos';
import { CommonSwap } from '../../types/common-swap';
import { CommonTokenTransfer, CommonTransaction } from '../../types/common-transaction';
import { NETWORK_BITCOIN, NETWORK_SPARK } from '../../types/networks';
import { CachedTokenInfo, NftInfo } from '../../types/token-info';
import { IStorage, STORAGE_KEY_SPARK_LN_INVOICE_IDS, STORAGE_KEY_SPARK_REFUNDED_DEPOSITS } from '../../types/IStorage';
import { ArkWallet } from './ark-wallet';
import { InterfaceAccountBasedWallet } from './interface-account-based-wallet';
import { InterfaceCanHaveTokens } from './interface-can-have-tokens';
import { createLightningInvoiceResponse, InterfaceLightningWallet, LightningPaymentLimitsResponse } from './interface-lightning-wallet';
import { uint8ArrayToHex, uint8ArrayToString } from '../../modules/uint8array-extras';
import { InterfaceCanHaveNfts } from './interface-can-have-nfts';

// copypasted from `node_modules/@buildonspark/spark-sdk/dist/...` since its not exported
type Bech32mTokenIdentifier = `btkn1${string}` | `btknrt1${string}` | `btknt1${string}` | `btkns1${string}` | `btknl1${string}`;
type SparkTokenMetadata = TokenBalanceMap extends Map<string, { tokenMetadata: infer Metadata }> ? Metadata : never;

export interface ISparkAdapter {
  initialize(...options: Parameters<typeof SDK.initialize>): ReturnType<typeof SDK.initialize>;
}

const STORAGE_KEY_NFT = 'SPARK_NFT_METADATA';
const STORAGE_KEY = 'SPARK_TOKEN_METADATA';

/**
 * On-chain confirmations a Bitcoin deposit to the static deposit address needs before Spark lets us
 * claim it. Per Spark docs; not exposed by the SDK, so this is the canonical source for it.
 */
export const SPARK_STATIC_DEPOSIT_CONFIRMATIONS = 3;

// Static cache for token icon URLs that we fetched from the API
const _tokenIconCache: Record<string, string> = {};

function uint8ArrayToBigInt(value: Uint8Array | undefined): bigint {
  if (!value || value.length === 0) return 0n;
  return BigInt(`0x${uint8ArrayToHex(value)}`);
}

// not exposed in the SDK
export type StaticDepositQuoteOutput = Awaited<ReturnType<SDK['getClaimStaticDepositQuote']>>;

export type SparkSDKWallet = Awaited<ReturnType<typeof SDK.initialize>>['wallet'];

export class SparkWallet extends ArkWallet implements InterfaceLightningWallet, InterfaceAccountBasedWallet, InterfaceCanHaveTokens, InterfaceCanHaveNfts {
  private _sdkWallet: SparkSDKWallet | undefined = undefined;
  /** SDK wallets indexed by account number */
  private static _sdkWalletsByAccount: Map<number, SparkSDKWallet> = new Map();
  protected adapter: ISparkAdapter;
  private _storage: IStorage | undefined = undefined;
  private _refundedDepositTxids: Set<string> = new Set();
  _lastNftsFetch: number = 0;
  _lastTokensFetch: number = 0;

  private tokenBalances: TokenBalanceMap = new Map();

  constructor() {
    super();
    this.adapter = globalThis.sparkAdapter;
  }

  async init(storage: IStorage) {
    assert(this.secret, 'Internal error: cant init Spark wallet, secret is not set.');

    this._storage = storage;

    const { wallet } = await this.adapter.initialize({
      mnemonicOrSeed: this.secret,
      // >> "If no account number is provided, our JS-SDK defaults accountNumber to 1 to support
      // >> backwards compatability for mainnet wallets created with earlier versions of the SDK."
      // @see https://docs.spark.money/wallet/documentation/api-reference
      accountNumber: this._accountNumber + 1, // see comment above, we need to add 1 because Spark basically starts counting at 1
      options: {
        network: 'MAINNET',
      },
    });

    wallet.on('transfer:claimed', (transferId: string, updatedBalance: bigint) => {
      console.log(`Transfer ${transferId} claimed. New balance: ${updatedBalance}`);
    });

    this._sdkWallet = wallet;
    SparkWallet._sdkWalletsByAccount.set(this._accountNumber, wallet);

    const raw = await storage.getItem(STORAGE_KEY_SPARK_REFUNDED_DEPOSITS);
    if (raw) {
      try {
        const txids: string[] = JSON.parse(raw);
        txids.forEach((txid) => this._refundedDepositTxids.add(txid));
      } catch {}
    }
  }

  private _lnInvoiceIdsStorageKey() {
    return `${STORAGE_KEY_SPARK_LN_INVOICE_IDS}_${this._accountNumber}`;
  }

  private async _readLnInvoiceIdMap(): Promise<Record<string, string>> {
    const raw = await this._storage?.getItem(this._lnInvoiceIdsStorageKey());
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return {};
    }
  }

  static getSDKWalletForAccount(accountNumber: number): SparkSDKWallet | undefined {
    return SparkWallet._sdkWalletsByAccount.get(accountNumber);
  }

  async getTransaction() {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    const transfers = await this._sdkWallet.getTransfers(1000, 0);
    return transfers.transfers;
  }

  async payLightningInvoice(invoice: string, masFeePercentage: number = 1) {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    const decoded = bolt11.decode(invoice);
    if (!decoded.satoshis) throw new Error('Cant pay zero-amount invoices');

    const maxFeeSats = Math.max(2, Math.ceil((decoded.satoshis / 100) * masFeePercentage));

    const payment_response = await this._sdkWallet.payLightningInvoice({
      invoice,
      maxFeeSats,
    });
    console.log('Payment Response:', payment_response);

    if (payment_response.status === 'LIGHTNING_PAYMENT_SUCCEEDED' || payment_response.status === 'LIGHTNING_PAYMENT_INITIATED') {
      return true;
    }

    return false;
  }

  async getOffchainReceiveAddress(): Promise<string> {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    return await this._sdkWallet.getSparkAddress();
  }

  async pay(receiverSparkAddress: string, amountSats: number): Promise<string> {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    const transfer = await this._sdkWallet.transfer({
      receiverSparkAddress,
      amountSats,
    });

    console.log('Transfer:', transfer);
    return transfer.id;
  }

  async getOffchainBalance(): Promise<number> {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');
    const balance = await this._sdkWallet.getBalance();
    this.tokenBalances = balance.tokenBalances;

    // fetching tokens metadata
    for (const [tokenId, { tokenMetadata }] of this.tokenBalances.entries()) {
      if (this.isNft(tokenMetadata)) continue; // NFTs images are fetched in other place, so we just save ourself extra unnecessary network request
      let remoteMetadata: any;
      const cacheKey = `${STORAGE_KEY}-${tokenId}`;
      if (!this._storage) console.warn('Warning: no storage available, no caching for tokens image URLs');
      const cachedTokenMetadata = await this._storage?.getItem(cacheKey);
      if (cachedTokenMetadata) {
        // cache hit
        remoteMetadata = JSON.parse(cachedTokenMetadata) as unknown;
      } else {
        // cache miss
        const response = await fetch(`https://api.sparkscan.io/v1/tokens/${tokenId}`);
        remoteMetadata = await response.json();
        await this._storage?.setItem(cacheKey, JSON.stringify(remoteMetadata));
      }

      if (remoteMetadata?.metadata?.iconUrl) {
        _tokenIconCache[tokenId] = String(remoteMetadata.metadata.iconUrl);
      }
    }
    // end fetch tokens metadata

    this._lastBalanceFetch = Date.now();
    this._lastNftsFetch = Date.now();
    this._lastTokensFetch = Date.now();

    return Number(balance.balance);
  }

  getTokenBalances(): CachedTokenInfo[] {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');
    const ret: CachedTokenInfo[] = [];
    for (const [tokenIdentifier, { ownedBalance, tokenMetadata }] of this.tokenBalances.entries()) {
      if (this.isNft(tokenMetadata)) continue;
      ret.push({
        name: tokenMetadata.tokenName,
        symbol: tokenMetadata.tokenTicker,
        chainId: 0, // N/A
        decimals: tokenMetadata.decimals,
        id: tokenIdentifier,
        balance: ownedBalance.toString(),
        logoURI: _tokenIconCache[tokenIdentifier],
      });
    }

    return ret;
  }

  async createLightningInvoice(amountSats: number, memo: string = ''): Promise<createLightningInvoiceResponse> {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    const invoice = await this._sdkWallet.createLightningInvoice({
      amountSats,
      memo,
    });

    console.log('Invoice:', invoice);

    const map = await this._readLnInvoiceIdMap();
    map[invoice.invoice.encodedInvoice] = invoice.id;
    await this._storage?.setItem(this._lnInvoiceIdsStorageKey(), JSON.stringify(map));

    return {
      invoice: invoice.invoice.encodedInvoice,
      serviceFeeSat: 0, // im currently not aware of any fees that Spark takes when receiving
    };
  }

  async isInvoicePaid(invoice: string): Promise<boolean> {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    const id = (await this._readLnInvoiceIdMap())[invoice];
    if (!id) return false;

    return this._isReceiveRequestPaid(id);
  }

  async isInvoicePaidByHash(preimageHash: string): Promise<boolean> {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');
    if (!preimageHash) throw new Error('No preimage hash provided');

    // we only persist invoice->id, not hash->id, so we decode every issued invoice we know about
    // and find the one whose payment hash matches. the map is bounded by how many invoices this
    // account has ever created, so a linear scan is fine.
    const target = preimageHash.toLowerCase();
    const map = await this._readLnInvoiceIdMap();
    for (const [invoice, id] of Object.entries(map)) {
      try {
        const decoded = bolt11.decode(invoice);
        for (const tag of decoded.tags) {
          if (tag.tagName === 'payment_hash' && String(tag.data).toLowerCase() === target) {
            return this._isReceiveRequestPaid(id);
          }
        }
      } catch {
        // ignore malformed persisted invoices, dont let one bad record break the lookup
      }
    }
    return false;
  }

  private async _isReceiveRequestPaid(id: string): Promise<boolean> {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    const lightningPaymentStatus = await this._sdkWallet.getLightningReceiveRequest(id);

    if (lightningPaymentStatus?.status === 'LIGHTNING_PAYMENT_RECEIVED') return true;
    if (lightningPaymentStatus?.status === 'TRANSFER_COMPLETED') return true;

    return false;
  }

  async fetchLightningLimits(): Promise<LightningPaymentLimitsResponse> {
    return Promise.resolve({
      send: {
        maxSat: -1,
        minSat: -1,
        maxZeroConfSat: -1,
      },
      receive: {
        maxZeroConfSat: 0,
        minSat: 0,
        maxSat: 100000000,
      },
    });
  }

  async getCommonTransactions(): Promise<CommonTransaction[]> {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    type WalletTransfer = Awaited<ReturnType<typeof this._sdkWallet.getTransfers>>['transfers'][number];
    type WalletTokenTransaction = Awaited<ReturnType<typeof this._sdkWallet.queryTokenTransactionsWithFilters>>['tokenTransactionsWithStatus'][number];

    // fetch all transfers in chunks of 100
    const transfers: WalletTransfer[] = [];
    let offset = 0;
    while (true) {
      const { transfers: tr } = await this._sdkWallet.getTransfers(100, offset);
      if (tr.length === 0) break;
      transfers.push(...tr);
      offset += 100;
    }

    const commonTransactions: CommonTransaction[] = [];
    for (const transfer of transfers) {
      const timestamp = Math.floor((transfer.updatedTime ?? transfer.createdTime)!.getTime() / 1000);
      const status = transfer.status === 'TRANSFER_STATUS_COMPLETED' ? 'confirmed' : 'pending';
      const direction = transfer.transferDirection === 'OUTGOING' ? 'send' : 'receive';

      // Determine counterparty address, use identity public key to get the address
      let counterparty: string | undefined;
      if (transfer.senderIdentityPublicKey && transfer.receiverIdentityPublicKey) {
        const counterpartyIdentityPublicKey = direction === 'send' ? transfer.receiverIdentityPublicKey : transfer.senderIdentityPublicKey;

        try {
          counterparty = encodeSparkAddress({
            identityPublicKey: counterpartyIdentityPublicKey,
            network: 'MAINNET',
          });
        } catch (error) {
          globalThis.handleError?.(error, 'spark-wallet.ts');
          console.error('Failed to encode Spark counterparty address:', error);
          // Fallback: use identity public key as identifier if encoding fails
          counterparty = counterpartyIdentityPublicKey;
        }
      }

      commonTransactions.push({
        network: NETWORK_SPARK,
        txid: transfer.id,
        amount: transfer.totalValue,
        timestamp,
        status,
        direction,
        counterparty,
        explorerUrl: `${AllNetworkInfos[NETWORK_SPARK].explorerUrl}/tx/${transfer.id}`,
      });
    }

    console.log('fetching spark tokens...');
    const startTokensFetch = Date.now();

    const ownSparkAddress = await this._sdkWallet.getSparkAddress();
    const ownIdentityPublicKey = await this._sdkWallet.getIdentityPublicKey();
    const tokenTransactions: WalletTokenTransaction[] = [];
    let cursor: string | undefined;

    while (true) {
      const response = await this._sdkWallet.queryTokenTransactionsWithFilters({
        sparkAddresses: [ownSparkAddress],
        pageSize: 100,
        cursor,
        direction: 'NEXT',
      });
      tokenTransactions.push(...response.tokenTransactionsWithStatus);

      if (!response.pageResponse?.hasNextPage || !response.pageResponse.nextCursor) break;
      cursor = response.pageResponse.nextCursor;
    }

    const ambiguousTokenTransactions = tokenTransactions.filter((entry) => {
      const tx = entry.tokenTransaction;
      if (!tx || tx.tokenInputs?.$case !== 'transferInput') return false;

      let ownOutputsCount = 0;
      let externalOutputsCount = 0;
      for (const output of tx.tokenOutputs) {
        if (uint8ArrayToHex(output.ownerPublicKey) === ownIdentityPublicKey) ownOutputsCount++;
        else externalOutputsCount++;
      }

      return ownOutputsCount > 0 && externalOutputsCount > 0;
    });

    const previousHashes = [
      ...new Set(
        ambiguousTokenTransactions.flatMap((entry) => {
          const tx = entry.tokenTransaction;
          if (!tx || tx.tokenInputs?.$case !== 'transferInput') return [];
          return tx.tokenInputs.transferInput.outputsToSpend.map((input) => uint8ArrayToHex(input.prevTokenTransactionHash));
        })
      ),
    ];

    const previousTransactions = new Map<string, WalletTokenTransaction>();
    for (let i = 0; i < previousHashes.length; i += 100) {
      const chunk = previousHashes.slice(i, i + 100);
      if (chunk.length === 0) continue;

      const response = await this._sdkWallet.queryTokenTransactionsByTxHashes(chunk);
      for (const entry of response.tokenTransactionsWithStatus) {
        if (!entry) continue;
        previousTransactions.set(uint8ArrayToHex(entry.tokenTransactionHash), entry);
      }
    }

    for (const entry of tokenTransactions) {
      const tx = entry.tokenTransaction;
      if (!tx) continue;

      const txid = uint8ArrayToHex(entry.tokenTransactionHash);
      const timestamp = Math.floor((tx.clientCreatedTimestamp ?? tx.expiryTime ?? new Date(0)).getTime() / 1000);
      const ownOutputs = tx.tokenOutputs.filter((output) => uint8ArrayToHex(output.ownerPublicKey) === ownIdentityPublicKey);
      const externalOutputs = tx.tokenOutputs.filter((output) => uint8ArrayToHex(output.ownerPublicKey) !== ownIdentityPublicKey);
      const hasMixedOutputs = ownOutputs.length > 0 && externalOutputs.length > 0;
      let inputOwners: Array<string | undefined> = [];
      if (hasMixedOutputs && tx.tokenInputs?.$case === 'transferInput') {
        inputOwners = tx.tokenInputs.transferInput.outputsToSpend.map((input) => {
          const previousTx = previousTransactions.get(uint8ArrayToHex(input.prevTokenTransactionHash))?.tokenTransaction;
          const spentOutput = previousTx?.tokenOutputs[input.prevTokenTransactionVout];
          return spentOutput ? uint8ArrayToHex(spentOutput.ownerPublicKey) : undefined;
        });
      }

      const isOutgoing = inputOwners.some((owner) => owner === ownIdentityPublicKey);
      const direction = hasMixedOutputs ? (isOutgoing ? 'send' : 'receive') : externalOutputs.length > 0 ? 'send' : ownOutputs.length > 0 ? 'receive' : 'other';
      const relevantOutputs = direction === 'send' ? externalOutputs : ownOutputs;
      if (relevantOutputs.length === 0) continue;

      const tokenTransfers: CommonTokenTransfer[] = [];
      for (const output of relevantOutputs) {
        if (!output.tokenIdentifier) continue;

        const tokenId = encodeBech32mTokenIdentifier({
          tokenIdentifier: output.tokenIdentifier,
          network: 'MAINNET',
        });

        let address: string | undefined;
        const ownerPublicKey = uint8ArrayToHex(output.ownerPublicKey);
        if (ownerPublicKey !== ownIdentityPublicKey) {
          address = encodeSparkAddress({
            identityPublicKey: ownerPublicKey,
            network: 'MAINNET',
          });
        }

        const tokenMetadata = this.tokenBalances.get(tokenId)?.tokenMetadata;
        let remoteMetadata: any;
        if (!tokenMetadata) {
          const cacheKey = `${STORAGE_KEY}-${tokenId}`;
          if (!this._storage) console.warn('Warning: no storage available, no caching for tokens image URLs');

          const cachedTokenMetadata = await this._storage?.getItem(cacheKey);
          if (cachedTokenMetadata) {
            try {
              remoteMetadata = JSON.parse(cachedTokenMetadata) as unknown;
            } catch {}
          }

          if (!remoteMetadata) {
            try {
              const response = await fetch(`https://api.sparkscan.io/v1/tokens/${tokenId}`);
              if (!response.ok) throw new Error(`Failed to fetch Spark token metadata: ${response.status}`);
              remoteMetadata = await response.json();
              await this._storage?.setItem(cacheKey, JSON.stringify(remoteMetadata));
            } catch (error) {
              globalThis.handleError?.(error, 'spark-wallet.ts');
              console.warn(`Failed to fetch Spark token metadata for ${tokenId}:`, error);
            }
          }

          remoteMetadata = remoteMetadata?.metadata ?? remoteMetadata;
          if (remoteMetadata?.iconUrl) {
            _tokenIconCache[tokenId] = String(remoteMetadata.iconUrl);
          }
        }

        tokenTransfers.push({
          tokenId,
          amount: Number(uint8ArrayToBigInt(output.tokenAmount)),
          address,
          decimals: tokenMetadata?.decimals ?? remoteMetadata?.decimals ?? 0,
          name: tokenMetadata?.tokenName ?? remoteMetadata?.tokenName ?? remoteMetadata?.name,
          symbol: tokenMetadata?.tokenTicker ?? remoteMetadata?.tokenTicker ?? remoteMetadata?.ticker ?? remoteMetadata?.symbol,
          logoURI: _tokenIconCache[tokenId] ?? remoteMetadata?.iconUrl ?? remoteMetadata?.logoURI,
        });
      }
      if (tokenTransfers.length === 0) continue;

      let counterparty: string | undefined;
      if (direction === 'send') {
        counterparty = tokenTransfers.find((transfer) => transfer.address)?.address;
      } else if (direction === 'receive') {
        const senderPublicKey = inputOwners.find((owner) => owner && owner !== ownIdentityPublicKey);
        if (senderPublicKey) {
          counterparty = encodeSparkAddress({
            identityPublicKey: senderPublicKey,
            network: 'MAINNET',
          });
        }
      }

      commonTransactions.push({
        network: NETWORK_SPARK,
        txid,
        amount: undefined,
        tokenTransfers,
        timestamp,
        status: entry.status === 2 ? 'confirmed' : entry.status === 3 || entry.status === 4 ? 'cancelled' : 'pending',
        direction,
        counterparty,
        explorerUrl: `${AllNetworkInfos[NETWORK_SPARK].explorerUrl}/tx/${txid}`,
      });
    }

    const endTokensFetch = Date.now();
    console.log('spark token transactions fetch took', (endTokensFetch - startTokensFetch) / 1000, 'sec');

    commonTransactions.sort((a, b) => b.timestamp - a.timestamp);
    return commonTransactions;
  }

  async transferToken(tokenIdentifier: string, tokenAmount: bigint, receiverSparkAddress: string): Promise<string> {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    return await this._sdkWallet.transferTokens({ receiverSparkAddress, tokenAmount, tokenIdentifier: tokenIdentifier as Bech32mTokenIdentifier });
  }

  async transferNFT(nft: NftInfo, address: string): Promise<string> {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    return this.transferToken(nft.tokenId, 1n, address);
  }

  allowLightning() {
    return true;
  }

  async getOnchainDepositAddress(): Promise<string> {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    return await this._sdkWallet.getStaticDepositAddress();
  }

  async getCommonSwaps(): Promise<CommonSwap[]> {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    const address = await this.getOnchainDepositAddress();
    if (!BlueElectrum.mainConnected) await BlueElectrum.connectMain();

    const explorerBase = AllNetworkInfos[NETWORK_BITCOIN].explorerUrl;
    const swaps: CommonSwap[] = [];

    // at first we get unclaimed swaps. This is our UTXOs
    const UTXOs = await BlueElectrum.multiGetUtxoByAddress([address]);
    const txs1 = await BlueElectrum.multiGetTransactionByTxid([...UTXOs[address].map((output) => output.txid)], true);
    const unclaimedSwaps: CommonSwap[] = UTXOs[address].map((output) => {
      const tx = txs1[output.txid];
      const timestamp = tx.blocktime ? tx.blocktime * 1000 : new Date().getTime();
      const confirmations = tx.confirmations ?? 0;
      const claimable = confirmations >= SPARK_STATIC_DEPOSIT_CONFIRMATIONS;
      return {
        network: NETWORK_SPARK,
        id: output.txid,
        status: claimable ? 'claimable' : 'pending',
        amount: output.value,
        timestamp,
        direction: 'receive',
        explorerUrl: `${explorerBase}/tx/${output.txid}`,
        // we only want to show confirmations for 'pending' swaps
        confirmations: !claimable ? confirmations : undefined,
        targetConfirmations: !claimable ? SPARK_STATIC_DEPOSIT_CONFIRMATIONS : undefined,
      };
    });
    swaps.push(...unclaimedSwaps);

    // now we need to get sent transactions. This is our claimed swaps
    const txsByAddress = await BlueElectrum.getTransactionsByAddress(address);
    const txs2 = await BlueElectrum.multiGetTransactionByTxid([...txsByAddress.map((tx) => tx.tx_hash)], true);
    const filteredTxs = Object.values(txs2) // TODO: distinguish between Claim and Refund. How to do this?
      // filter out incoming transactions
      .filter((tx) => !tx.vout.some((output) => output.scriptPubKey.addresses.some((a) => a === address)))
      // only include transactions with one input and one output
      .filter((tx) => tx.vin.length === 1 && tx.vout.length === 1);
    const claimedSwaps: CommonSwap[] = filteredTxs.map((tx) => {
      const timestamp = tx.blocktime ? tx.blocktime * 1000 : new Date().getTime();
      const inputTxid = tx.vin[0]?.txid;
      return {
        network: NETWORK_SPARK,
        id: tx.txid,
        status: 'confirmed',
        timestamp,
        amount: BigNumber(tx.vout[0].value).multipliedBy(100000000).toNumber(),
        direction: 'receive',
        explorerUrl: `${explorerBase}/tx/${tx.txid}`,
        depositTxid: inputTxid,
        refunded: inputTxid ? this._refundedDepositTxids.has(inputTxid) : undefined,
      };
    });
    swaps.push(...claimedSwaps);

    swaps.sort((a, b) => b.timestamp! - a.timestamp!);

    return swaps;
  }

  async getDepositQuote(txid: string): Promise<StaticDepositQuoteOutput> {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    const quote = await this._sdkWallet.getClaimStaticDepositQuote(txid);
    return quote;
  }

  async claimDepositSpark(quote: StaticDepositQuoteOutput): Promise<string | undefined> {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    const result = await this._sdkWallet.claimStaticDeposit({
      transactionId: quote.transactionId,
      creditAmountSats: quote.creditAmountSats,
      sspSignature: quote.signature,
    });
    return result?.transferId;
  }

  async fetchTokenBalances(): Promise<void> {
    if (this._lastBalanceFetch > 0 && Date.now() - this._lastBalanceFetch > 5_000) {
      // tokens are fetched in `getOffchainBalance`, but since it was called a long time ago lets call it again
      // so we wont have stale data
      await this.getOffchainBalance();
    }
  }

  parseBNFTMetadata(extraMetadata: Uint8Array | undefined) {
    const metadataString = uint8ArrayToString(extraMetadata ?? new Uint8Array());
    if (typeof metadataString !== 'string' || metadataString.length === 0) {
      throw new Error('Invalid BNFT collection metadata');
    }

    const prefix = metadataString.slice(0, 4);
    const locationCode = metadataString.slice(4, 6);
    const metadataTypeCode = metadataString.slice(6, 9);
    const hash = metadataString.slice(9);

    if (prefix !== 'BNFT' || (metadataTypeCode !== '000' && metadataTypeCode !== '001') || locationCode.length !== 2 || hash.length === 0) {
      throw new Error('Invalid BNFT token/collection metadata');
    }

    return { locationCode, metadataTypeCode, hash };
  }

  isNft(tokenMetadata: SparkTokenMetadata): boolean {
    if (tokenMetadata.decimals !== 0) return false;
    if (tokenMetadata.maxSupply !== BigInt(1)) return false;

    const extraMetadataString = uint8ArrayToString(tokenMetadata.extraMetadata ?? new Uint8Array());
    return extraMetadataString.startsWith('BNFT');
  }

  public async fetchNfts(): Promise<NftInfo[]> {
    await this.fetchTokenBalances(); // NFTS are just tokens with a special identifier and supply of 1

    const ret: NftInfo[] = [];
    for (const [tokenIdentifier, { tokenMetadata, ownedBalance }] of this.tokenBalances.entries()) {
      if (!this.isNft(tokenMetadata)) continue;

      if (ownedBalance === BigInt(0)) continue; // we dont have it actually, skip it

      let bnftMetadata: ReturnType<typeof this.parseBNFTMetadata>;
      try {
        bnftMetadata = this.parseBNFTMetadata(tokenMetadata.extraMetadata);
      } catch (error) {
        globalThis.handleError?.(error, 'spark-wallet.ts');
        // something went wrong, lets skip this NFT
        continue;
      }

      if (bnftMetadata.metadataTypeCode !== '001') {
        // not an NFT, maybe a collection info (if its '000')
        // lets skip it
        continue;
      }

      const cacheKey = `${STORAGE_KEY_NFT}:${bnftMetadata.hash}`;

      // trying cache first:
      let nftInfo: any = await this._storage?.getItem(cacheKey);
      if (nftInfo) {
        try {
          nftInfo = JSON.parse(nftInfo);
        } catch (_) {}
      }

      if (!nftInfo) {
        // cache miss
        const response = await fetch(`https://arweave.net/${bnftMetadata.hash}`);
        nftInfo = await response.json();
      }

      if (nftInfo.name) {
        // response ok, lets cache it
        this._storage?.setItem(cacheKey, JSON.stringify(nftInfo));
      } else {
        // something went wrong, lets skip this NFT
        console.error('Malformed NFT info:', nftInfo);
        continue;
      }

      let image = nftInfo?.image ?? '';
      if (image.startsWith('AR://')) {
        image = image.replace('AR://', '');
        image = `https://arweave.net/${image}`;
      }

      ret.push({
        name: nftInfo?.name ?? tokenMetadata.tokenName,
        contractAddress: tokenMetadata.tokenPublicKey, // ??? makes no sense in spark, for transfer we need only the token identifier
        tokenId: tokenIdentifier,
        collectionName: nftInfo?.symbol ?? '',
        description: nftInfo?.description ?? '',
        image,
      });
    }

    return ret;
  }

  async refundDeposit(txid: string, destinationAddress: string): Promise<void> {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    if (!BlueElectrum.mainConnected) await BlueElectrum.connectMain();
    const fees = await BlueElectrum.estimateFees();

    const hex = await this._sdkWallet.refundStaticDeposit({
      depositTransactionId: txid,
      destinationAddress,
      satsPerVbyteFee: fees.fast,
    });

    await BlueElectrum.broadcastV2(hex);
    this._refundedDepositTxids.add(txid);
    await this._storage?.setItem(STORAGE_KEY_SPARK_REFUNDED_DEPOSITS, JSON.stringify([...this._refundedDepositTxids]));
  }

  /**
   * Static method to validate Spark addresses without creating an instance
   * @param address The Spark address to validate
   * @returns true if the address is valid, false otherwise
   */
  static isAddressValid(address: string): boolean {
    try {
      return isValidSparkAddress(address);
    } catch (error) {
      return false;
    }
  }

  /**
   * Another way to call {@link SparkWallet.isAddressValid}
   */
  isAddressValid(address: string): boolean {
    return SparkWallet.isAddressValid(address);
  }
}
