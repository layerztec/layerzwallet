import { signTypedData, SignTypedDataVersion, TypedMessage } from '@metamask/eth-sig-util';
import BigNumber from 'bignumber.js';
import { ethers, TransactionRequest, Wallet } from 'ethers';
import { getChainIdByNetwork, getRpcProvider } from '../models/network-getters';
import { Networks } from '../types/networks';
import { StringNumber } from '../types/string-number';
import assert from 'assert';
import { TokenInfo } from '../types/token-info';
import { hexStr } from '../modules/string-utils';
import { ICsprng } from '../types/ICsprng';

export class EvmWallet {
  private static readonly DEFAULT_GAS_LIMIT = 250_000;
  private static readonly SIMPLE_TRANSFER_GAS = 21000;
  private static readonly HD_PATH = "m/44'/60'/0'/0";

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
    const iface = new ethers.Contract(token.address, ['function transfer(address,uint256)']);
    const data = iface.interface.encodeFunctionData('transfer', [to, amount]);

    return { data, from, to: token.address };
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
