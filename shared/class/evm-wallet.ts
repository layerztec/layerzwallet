import assert from 'assert';
import BigNumber from 'bignumber.js';
import { ethers, TransactionRequest, Wallet } from 'ethers';

import { signTypedData, SignTypedDataVersion, TypedMessage } from '@metamask/eth-sig-util';
import { getChainIdByNetwork, getRpcProvider } from '../models/network-getters';
import { getTokenInfo } from '../models/token-list';
import { Networks } from '../types/networks';
import { SendQuote, SendQuoteRequest } from '../types/send-quote';
import { StringNumber } from '../types/string-number';
import { TokenInfo } from '../types/token-info';
import { hexStr } from '../modules/string-utils';
import { ICsprng } from '../types/ICsprng';
import { CommonTransaction, CommonTokenTransfer, TransactionStatus } from '../types/common-transaction';
import { AllNetworkInfos } from '../models/all-network-infos';
import { InterfaceSendQuotable } from './wallets/interface-send-quotable';

type ExplorerAction = 'txlist' | 'txlistinternal' | 'tokentx';

type ActionData = any; // TODO: type this

/**
 * Building block for constructing CommonTransaction[]
 */
type Building = {
  txid: string;
  timestamp?: number;
  blockHeight?: number;
  confirmations?: number;
  status?: TransactionStatus;
  baseValueDeltaWei: bigint; // net change to wallet in wei (positive if receive)
  counterparty?: string;
  tokenTransfers: CommonTokenTransfer[];
  tokenIn?: boolean;
  tokenOut?: boolean;
  feeWei?: bigint; // total fee we paid (wei)
};

const toNum = (v: any | undefined): number | undefined => (v === undefined || v === null || v === '' ? undefined : Number(v));
const toBigInt = (v: any | undefined): bigint => {
  try {
    return BigInt(v ?? 0);
  } catch (_) {
    return 0n;
  }
};

export class EvmWallet implements InterfaceSendQuotable {
  private static readonly DEFAULT_GAS_LIMIT = 250_000;
  private static readonly SIMPLE_TRANSFER_GAS = 21000;
  private static readonly HD_PATH = "m/44'/60'/0'/0";
  private explorerProgressCache: Map<ExplorerAction, number> = new Map();
  private explorerDataCache: Map<ExplorerAction, Record<string, ActionData>> = new Map();
  public address?: string;
  public network?: Networks;
  public etherScanApiUrl?: string;

  async createPaymentTransaction(from: string, to: string, amount: StringNumber): Promise<TransactionRequest> {
    return {
      from,
      to,
      gasLimit: EvmWallet.SIMPLE_TRANSFER_GAS,
      value: BigInt(amount),
    };
  }

  private setTransactionGasFee(tx: TransactionRequest, fee: ethers.FeeData, overpayMultiplier: bigint = 1n) {
    if (fee.maxPriorityFeePerGas && fee.maxFeePerGas) {
      tx.maxPriorityFeePerGas = fee.maxPriorityFeePerGas * overpayMultiplier;
      tx.maxFeePerGas = fee.maxFeePerGas * overpayMultiplier;
      tx.type = 2;
    } else {
      tx.type = 0;
      tx.gasPrice = fee.gasPrice ? fee.gasPrice * overpayMultiplier : undefined;
    }
  }

  async prepareTransaction(transaction: TransactionRequest, network: Networks, fee: ethers.FeeData, overpayMultiplier: bigint = 1n): Promise<TransactionRequest> {
    assert(transaction.from, 'transaction.from is mandatory');

    // @ts-ignore `.gas` is not in the type definition, but might be present from real Dapp
    const gasLimit = transaction.gas ?? transaction.gasLimit ?? EvmWallet.DEFAULT_GAS_LIMIT;
    const chainId = getChainIdByNetwork(network);
    const nonce = transaction.nonce ?? (await this.getNonce(network, transaction.from.toString()));

    const txPayload: TransactionRequest = {
      to: transaction.to,
      from: transaction.from,
      chainId: new BigNumber(chainId).toNumber(),
      data: transaction.data,
      value: hexStr(transaction.value),
      gasLimit,
      nonce,
    };

    this.setTransactionGasFee(txPayload, fee, overpayMultiplier);
    return txPayload;
  }

  async createTokenTransferTransaction(from: string, to: string, token: TokenInfo, amount: StringNumber): Promise<TransactionRequest> {
    // Because Rootstock uses a different checksum format than Ethereum (EIP-1191 vs. EIP-55), we lowercase the token ID to avoid checksum issues
    // TODO: implement a proper checksum converter
    const tokenId = token.id.toLowerCase();
    const iface = new ethers.Contract(tokenId, ['function transfer(address,uint256)']);
    const data = iface.interface.encodeFunctionData('transfer', [to, amount]);

    return { data, from, to: tokenId };
  }

  private getWalletFromMnemonic(mnemonic: string, accountNumber: number): Wallet {
    const hdWallet = ethers.HDNodeWallet.fromMnemonic(ethers.Mnemonic.fromPhrase(mnemonic), EvmWallet.HD_PATH);
    const child = hdWallet.derivePath(String(accountNumber));
    return new Wallet(child.privateKey);
  }

  async signTransaction(txPayload: TransactionRequest, mnemonic: string, accountNumber: number): Promise<string> {
    const wallet = this.getWalletFromMnemonic(mnemonic, accountNumber);
    return await wallet.signTransaction(txPayload);
  }

  async signPersonalMessage(message: string | Uint8Array, mnemonic: string, accountNumber: number): Promise<string> {
    const wallet = this.getWalletFromMnemonic(mnemonic, accountNumber);
    const messageToSign = typeof message === 'string' && message.startsWith('0x') ? arrayify(message) : message;
    return await wallet.signMessage(messageToSign);
  }

  async broadcastTransaction(network: Networks, signedTx: string): Promise<string> {
    const rpc = getRpcProvider(network);
    return rpc.send('eth_sendRawTransaction', [signedTx]);
  }

  async signTypedDataMessage(message: any, mnemonic: string, accountNumber: number): Promise<string> {
    const wallet = this.getWalletFromMnemonic(mnemonic, accountNumber);
    const pkeyBuffer = Buffer.from(wallet.privateKey.replace('0x', ''), 'hex');

    const parsedData = this.parseTypedDataMessage(message);
    const version = this.determineTypedDataVersion(parsedData);

    return signTypedData({
      data: parsedData as TypedMessage<TypedDataTypes>,
      privateKey: pkeyBuffer,
      version: version.toUpperCase() as SignTypedDataVersion,
    });
  }

  private parseTypedDataMessage(message: any): any {
    if (typeof message !== 'string') return message;
    try {
      return JSON.parse(message);
    } catch (e) {
      return message;
    }
  }

  private determineTypedDataVersion(data: any): string {
    return typeof data === 'object' && (data.types || data.primaryType || data.domain) ? 'v4' : 'v1';
  }

  static isMnemonicValid(mnemonic: string): boolean {
    try {
      ethers.HDNodeWallet.fromMnemonic(ethers.Mnemonic.fromPhrase(mnemonic));
      return true;
    } catch (_) {
      return false;
    }
  }

  static isAddressValid(address: string): boolean {
    return ethers.isAddress(address);
  }

  static mnemonicToXpub(mnemonic: string): string {
    const hdNode = ethers.HDNodeWallet.fromMnemonic(ethers.Mnemonic.fromPhrase(mnemonic), EvmWallet.HD_PATH);
    return hdNode.neuter().extendedKey;
  }

  static xpubToAddress(xpub: string, account: number): string {
    return ethers.HDNodeWallet.fromExtendedKey(xpub).derivePath(String(account)).address;
  }

  static async generateMnemonic(csprng: ICsprng): Promise<string> {
    return ethers.Mnemonic.entropyToPhrase(await csprng.randomBytes(16));
  }

  async getNonce(network: Networks, address: string): Promise<number> {
    const rpc = getRpcProvider(network);
    return await rpc.send('eth_getTransactionCount', [address, 'latest']);
  }

  async getFeeData(network: Networks): Promise<ethers.FeeData> {
    const rpc = getRpcProvider(network);
    return await rpc.getFeeData();
  }

  async getBaseFeePerGas(network: Networks): Promise<bigint> {
    const provider = getRpcProvider(network);
    const latestBlock = await provider.getBlock('latest');

    if (!latestBlock?.baseFeePerGas) {
      throw new Error('Failed to fetch base fee from last block ' + JSON.stringify(latestBlock, null, 2));
    }

    return latestBlock.baseFeePerGas;
  }

  calculateMinFee(baseFee: bigint, prepared: TransactionRequest): StringNumber {
    let calculatedMinFee = '0';
    if (prepared.maxPriorityFeePerGas && prepared.maxFeePerGas && prepared.gasLimit) {
      // type 2 transaction
      const priorityFee = new BigNumber(prepared.maxPriorityFeePerGas.toString());
      const gasLimit = new BigNumber(prepared.gasLimit.toString());
      calculatedMinFee = priorityFee.plus(baseFee.toString()).multipliedBy(gasLimit).toString();
    } else if (prepared.gasPrice && prepared.gasLimit) {
      // type 0 transaction
      const gasPrice = new BigNumber(prepared.gasPrice.toString());
      const gasLimit = new BigNumber(prepared.gasLimit.toString());
      calculatedMinFee = gasPrice.multipliedBy(gasLimit).toString();
    } else {
      throw new Error('Incomplete FeeData');
    }

    return calculatedMinFee;
  }

  calculateMaxFee(prepared: TransactionRequest): StringNumber {
    let calculatedMaxFee = '0';
    if (prepared.maxPriorityFeePerGas && prepared.maxFeePerGas) {
      // type 2 transaction
      calculatedMaxFee = new BigNumber(prepared.maxFeePerGas.toString()).multipliedBy(new BigNumber(prepared.gasLimit?.toString() ?? 1)).toString();
    } else if (prepared.gasPrice) {
      // type 0 transaction
      calculatedMaxFee = new BigNumber(prepared.gasPrice.toString()).multipliedBy(new BigNumber(prepared.gasLimit?.toString() ?? 1)).toString();
    } else {
      throw new Error('Incomplete FeeData');
    }

    return calculatedMaxFee;
  }

  async getSendQuote(request: SendQuoteRequest): Promise<SendQuote> {
    assert(this.network, 'EvmWallet.network must be set before calling getSendQuote');
    assert(request.fromAddress, 'fromAddress is required for EVM getSendQuote');

    let tx: TransactionRequest;
    if (request.tokenId) {
      const token = getTokenInfo(request.tokenId);
      tx = await this.createTokenTransferTransaction(request.fromAddress, request.toAddress, token, request.amount);
    } else {
      tx = await this.createPaymentTransaction(request.fromAddress, request.toAddress, request.amount);
    }

    const feeData = await this.getFeeData(this.network);
    const prepared = await this.prepareTransaction(tx, this.network, feeData);

    // Legacy chains (e.g. Rootstock) don't have baseFeePerGas — calculateMinFee
    // handles type 0 txs using gasPrice directly, so baseFee=0n is fine.
    let baseFee = 0n;
    try {
      baseFee = await this.getBaseFeePerGas(this.network);
    } catch {}
    const fee = this.calculateMinFee(baseFee, prepared);

    // Check balances
    const rpc = getRpcProvider(this.network);
    const nativeBalance = await rpc.getBalance(request.fromAddress!);
    if (request.tokenId) {
      // Token send: native balance must cover gas, token balance must cover amount
      if (nativeBalance < BigInt(fee)) {
        throw new Error(`Insufficient ${AllNetworkInfos[this.network].ticker} for gas`);
      }
      const abi = ['function balanceOf(address owner) view returns (uint256)'];
      const contract = new ethers.Contract(ethers.getAddress(request.tokenId), abi, rpc);
      const tokenBalance: bigint = await contract.balanceOf(ethers.getAddress(request.fromAddress!));
      if (tokenBalance < BigInt(request.amount)) {
        const token = getTokenInfo(request.tokenId);
        throw new Error(`Insufficient ${token.symbol} balance`);
      }
    } else {
      const totalNeeded = BigInt(request.amount) + BigInt(fee);
      if (nativeBalance < totalNeeded) {
        throw new Error(`Insufficient ${AllNetworkInfos[this.network].ticker} balance`);
      }
    }

    return {
      request,
      fee,
      feeTicker: AllNetworkInfos[this.network].ticker,
      _prepared: prepared,
    };
  }

  async executeSendQuote(quote: SendQuote, mnemonic?: string, accountNumber?: number): Promise<string> {
    assert(this.network, 'EvmWallet.network must be set before calling executeSendQuote');
    assert(mnemonic, 'mnemonic is required for EVM executeSendQuote');
    assert(accountNumber !== undefined, 'accountNumber is required for EVM executeSendQuote');

    const signedTx = await this.signTransaction(quote._prepared as TransactionRequest, mnemonic, accountNumber);
    return await this.broadcastTransaction(this.network, signedTx);
  }

  private getActionDataUniqueKey(action: ExplorerAction, r: any): string {
    if (action === 'txlist') return `${r.hash}:${r.transactionIndex ?? ''}`;
    if (action === 'txlistinternal') return `${r.transactionHash}:${r.index ?? ''}`;
    return `${r.hash}:${r.transactionIndex ?? ''}`; // tokentx
  }

  /**
   * Fetch latest block number. We can't use etherscan because Botanix blockexplorer(routescan)
   * doesn't support module: 'block', action: 'eth_block_number'
   */
  private async fetchLatestBlockNumberFromExplorer(baseUrl: string): Promise<number> {
    if (!this.network) throw new Error('Network not set');
    const rpc = getRpcProvider(this.network);
    const res = await rpc.send('eth_blockNumber', []);
    return parseInt(res, 16);
  }

  /**
   * Fetch a block segment for an action with pagination up to 10k per page and cache results.
   */
  async syncAccountHistorySegment(baseUrl: string, action: ExplorerAction, latestBlockNumber: number): Promise<void> {
    if (!this.address) throw new Error('Address not set');
    const address = this.address;
    const progressKey = action;
    const dataKey = action;
    const startBlock = this.explorerProgressCache.get(progressKey) ?? 0;
    const endBlock = latestBlockNumber;

    let page = 1;
    const maxPageBatch = 10000;

    const existingMap: Record<string, ActionData> = this.explorerDataCache.get(dataKey) ?? {};

    while (true) {
      const params: Record<string, string> = {
        module: 'account',
        action,
        address,
        startblock: String(startBlock),
        endblock: String(endBlock),
        sort: 'asc',
      };
      if (page > 1) {
        params.page = String(page);
        params.offset = String(maxPageBatch);
      }

      const url = `${baseUrl}?${new URLSearchParams(params).toString()}`;
      const response = await fetch(url);
      const data = await response.json();

      const okMessages = ['OK', 'No transactions found', 'No token transfers found', 'No internal transactions found'];
      if (!okMessages.includes(data.message)) {
        throw new Error('Failed to fetch history: ' + data.message);
      }

      const results: ActionData[] = Array.isArray(data.result) ? data.result : [];
      // de-duplicate into existingMap using a composite key
      for (const r of results) {
        const key = this.getActionDataUniqueKey(action, r);
        if (!existingMap[key]) {
          existingMap[key] = r;
        }
      }

      // if we got a full page of 10k, try next page; otherwise this segment is done
      if (results.length === maxPageBatch) {
        page += 1;
        continue;
      }
      break;
    }

    this.explorerDataCache.set(dataKey, existingMap);
    const nextStart = endBlock + 1;
    this.explorerProgressCache.set(progressKey, nextStart);
  }

  async fetchTransactions(): Promise<void> {
    if (!this.address) throw new Error('Address not set');
    if (!this.network) throw new Error('Network not set');
    if (!this.etherScanApiUrl) throw new Error('EtherScan API URL not set');
    const baseUrl = this.etherScanApiUrl;
    const latest = await this.fetchLatestBlockNumberFromExplorer(baseUrl);

    await Promise.all([
      this.syncAccountHistorySegment(baseUrl, 'tokentx', latest),
      this.syncAccountHistorySegment(baseUrl, 'txlist', latest),
      this.syncAccountHistorySegment(baseUrl, 'txlistinternal', latest),
    ]);
  }

  /**
   * Construct a list of CommonTransaction from Etherscan-compatible endpoints outputs
   * in the order: tokentx, txlist, txlistinternal.
   */
  getCommonTransactions(): CommonTransaction[] {
    const tokentx = Object.values(this.explorerDataCache.get('tokentx') ?? {});
    const txlist = Object.values(this.explorerDataCache.get('txlist') ?? {});
    const txlistinternal = Object.values(this.explorerDataCache.get('txlistinternal') ?? {});

    const address = this.address?.toLowerCase();
    if (!address) throw new Error('Address not set');
    const network = this.network;
    if (!network) throw new Error('Network not set');

    // Map of txid to Building block
    const byHash = new Map<string, Building>();
    const ensure = (hash: string): Building => {
      let item = byHash.get(hash);
      if (!item) {
        item = { txid: hash, baseValueDeltaWei: 0n, tokenTransfers: [] };
        byHash.set(hash, item);
      }
      return item;
    };

    // txlist: external transactions (native value, gas, status)
    for (const tx of txlist ?? []) {
      const hash = String(tx.hash);
      const item = ensure(hash);
      item.timestamp = toNum(tx.timeStamp) ?? item.timestamp;
      item.blockHeight = toNum(tx.blockNumber) ?? item.blockHeight;
      item.confirmations = toNum(tx.confirmations) ?? item.confirmations;
      const failed = String(tx.isError ?? tx.txreceipt_status) === '1' ? false : String(tx.isError) === '1' || String(tx.txreceipt_status) === '0';
      item.status = failed ? 'failed' : 'confirmed';

      const from = String(tx.from || '').toLowerCase();
      const to = String(tx.to || '').toLowerCase();
      const valueWei = toBigInt(tx.value);
      if (from === address) item.baseValueDeltaWei -= valueWei;
      if (to === address) item.baseValueDeltaWei += valueWei;

      // counterparty for native transfer if any
      if (!item.counterparty) {
        if (from === address && to) item.counterparty = to;
        else if (to === address && from) item.counterparty = from;
      }

      // FEE (wei) only if we pay it
      if (from === address) {
        const gasUsed = toBigInt(tx.gasUsed ?? '0');
        const eff = (tx as any).effectiveGasPrice ?? tx.gasPrice ?? '0';
        const gasPrice = toBigInt(eff);
        if (gasUsed > 0n && gasPrice > 0n) {
          item.feeWei = (item.feeWei ?? 0n) + gasUsed * gasPrice;
        }
      }
    }

    // txlistinternal: internal native transfers
    for (const itx of txlistinternal ?? []) {
      const hash = String(itx.transactionHash || itx.hash || itx.parentHash || '');
      if (!hash) continue;
      const item = ensure(hash);
      item.timestamp = toNum(itx.timeStamp) ?? item.timestamp;
      item.blockHeight = toNum(itx.blockNumber) ?? item.blockHeight;
      item.confirmations = toNum(itx.confirmations) ?? item.confirmations;
      // internal tx has no explicit status; keep existing
      const from = String(itx.from || '').toLowerCase();
      const to = String(itx.to || '').toLowerCase();
      const valueWei = toBigInt(itx.value);
      if (from === address) item.baseValueDeltaWei -= valueWei;
      if (to === address) item.baseValueDeltaWei += valueWei;

      if (!item.counterparty) {
        if (from === address && to) item.counterparty = to;
        else if (to === address && from) item.counterparty = from;
      }
    }

    // tokentx: token transfers
    for (const t of tokentx ?? []) {
      const hash = String(t.hash);
      const item = ensure(hash);
      item.timestamp = toNum(t.timeStamp) ?? item.timestamp;
      item.blockHeight = toNum(t.blockNumber) ?? item.blockHeight;
      item.confirmations = toNum(t.confirmations) ?? item.confirmations;

      const from = String(t.from || '').toLowerCase();
      const to = String(t.to || '').toLowerCase();
      if (!item.counterparty) {
        if (from === address && to) item.counterparty = to;
        else if (to === address && from) item.counterparty = from;
      }

      const transfer: CommonTokenTransfer = {
        amount: Number(t.value ?? 0), // base units
        address: from === address ? t.to || '' : t.from || '',
        tokenId: t.contractAddress || undefined,
        decimals: 0,
      };
      item.tokenTransfers.push(transfer);
      if (from === address) item.tokenOut = true;
      if (to === address) item.tokenIn = true;
    }

    // Finalize into CommonTransaction[]
    const result: CommonTransaction[] = [];
    for (const item of byHash.values()) {
      let direction: 'send' | 'receive' | 'other';
      if (item.baseValueDeltaWei !== 0n) {
        direction = item.baseValueDeltaWei > 0n ? 'receive' : 'send';
      } else if (item.tokenTransfers.length > 0) {
        if (item.tokenIn && !item.tokenOut) {
          direction = 'receive';
        } else if (item.tokenOut && !item.tokenIn) {
          direction = 'send';
        } else {
          direction = 'other';
        }
      } else {
        direction = 'other';
      }

      const amountNative = item.baseValueDeltaWei === 0n ? undefined : Number(item.baseValueDeltaWei < 0n ? -item.baseValueDeltaWei : item.baseValueDeltaWei);
      const explorerBase = AllNetworkInfos[network].explorerUrl;

      result.push({
        txid: item.txid,
        network,
        timestamp: item.timestamp ?? 0,
        direction,
        amount: amountNative,
        tokenTransfers: item.tokenTransfers.length ? item.tokenTransfers : undefined,
        status: item.status,
        confirmations: item.confirmations,
        counterparty: item.counterparty,
        blockHeight: item.blockHeight,
        explorerUrl: `${explorerBase}/tx/${item.txid}`,
        fee: item.feeWei ? Number(item.feeWei) : undefined,
      });
    }

    // Sort by timestamp ascending (oldest first) to match typical explorer pagination asc
    result.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    // now reverse to have the latest first
    return result.reverse();
  }
}

interface MessageTypeProperty {
  name: string;
  type: string;
}

interface TypedDataTypes {
  EIP712Domain: MessageTypeProperty[];
  [additionalProperties: string]: MessageTypeProperty[];
}

export function getTokenTransferCall(token: { chainId: number; contractAddress: string }, fromAddress: string, toAddress: string, amount: string): string {
  const iface = new ethers.Contract(token.contractAddress, ['function transfer(address,uint256)']);
  return iface.interface.encodeFunctionData('transfer', [toAddress, amount]);
}

export function arrayify(value: string): Uint8Array {
  const hex = value.substring(2);
  if (hex.length % 2) {
    throw new Error('hex data is odd-length ' + value);
  }

  const result = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    result[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }

  return addSlice(result);
}

function addSlice(array: Uint8Array): Uint8Array {
  // @ts-ignore
  if (array.slice) {
    return array;
  }

  // @ts-ignore
  array.slice = function () {
    const args = Array.prototype.slice.call(arguments);
    // @ts-ignore
    return addSlice(new Uint8Array(Array.prototype.slice.apply(array, args)));
  };

  return array;
}
