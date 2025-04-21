/**
 * Based on https://github.com/vulpemventures/marina-provider
 * LICENSE: MIT
 */

import { ECPairFactory } from 'ecpair';
import { Pset, Secp256k1Interface, Transaction, address, crypto, networks, payments } from 'liquidjs-lib';
import { varSliceSize, varuint } from 'liquidjs-lib/src/bufferutils';
import type { ElectrumWS } from 'ws-electrumx-client';
import ecc from '../../../blue_modules/noble_ecc';
import type { Asset, NetworkString, Utxo } from './types';
import { AccountType, Address, ScriptDetails } from './types';

const ecpair = ECPairFactory(ecc);

export function scriptDetailsWithKeyToAddress(network: networks.Network, type: AccountType, zkpLib: Secp256k1Interface) {
  return function (script: string, details: ScriptDetails, publicKey: string): Address {
    const addr: Address = {
      ...details,
      script,
      publicKey,
    };

    try {
      const unconfidentialAddress = address.fromOutputScript(Buffer.from(script, 'hex'), network);
      addr.unconfidentialAddress = unconfidentialAddress;
      if (details.blindingPrivateKey) {
        const blindingPublicKey = ecpair.fromPrivateKey(Buffer.from(details.blindingPrivateKey, 'hex')).publicKey;
        addr.confidentialAddress = address.toConfidential(unconfidentialAddress, blindingPublicKey);
      }
      return addr;
    } catch (e) {
      return addr;
    }
  };
}

export function h2b(hex: string): Buffer {
  return Buffer.from(hex, 'hex');
}

function bufferNotEmptyOrNull(buffer?: Buffer): boolean {
  return buffer != null && buffer.length > 0;
}

export function isConfidentialOutput({ rangeProof, surjectionProof, nonce }: any): boolean {
  const emptyNonce: Buffer = Buffer.from('0x00', 'hex');
  return bufferNotEmptyOrNull(rangeProof) && bufferNotEmptyOrNull(surjectionProof) && nonce !== emptyNonce;
}

const BroadcastTransaction = 'blockchain.transaction.broadcast'; // returns txid
const EstimateFee = 'blockchain.estimatefee'; // returns fee rate in sats/kBytes
const GetBlockHeader = 'blockchain.block.header'; // returns block header as hex string
const GetHistoryMethod = 'blockchain.scripthash.get_history';
const GetTransactionMethod = 'blockchain.transaction.get'; // returns hex string
const SubscribeStatusMethod = 'blockchain.scripthash'; // ElectrumWS automatically adds '.subscribe'
const GetRelayFeeMethod = 'blockchain.relayfee';
const ListUnspentMethod = 'blockchain.scripthash.listunspent';

const MISSING_TRANSACTION = 'missingtransaction';
const MAX_FETCH_TRANSACTIONS_ATTEMPTS = 5;

type UnspentElectrum = {
  height: number;
  tx_pos: number;
  tx_hash: string;
};

const DYNAFED_HF_MASK = 2147483648;
function deserializeBlockHeader(hex: string): BlockHeader {
  const buffer = Buffer.from(hex, 'hex');
  let offset = 0;

  let version = buffer.readUInt32LE(offset);
  offset += 4;

  const isDyna = (version & DYNAFED_HF_MASK) !== 0;
  if (isDyna) {
    version = version & ~DYNAFED_HF_MASK;
  }

  const previousBlockHash = buffer
    .subarray(offset, offset + 32)
    .reverse()
    .toString('hex');
  offset += 32;

  const merkleRoot = buffer.subarray(offset, offset + 32).toString('hex');
  offset += 32;

  const timestamp = buffer.readUInt32LE(offset);
  offset += 4;

  const height = buffer.readUInt32LE(offset);
  offset += 4;

  return {
    version,
    previousBlockHash,
    merkleRoot,
    timestamp,
    height,
  };
}

const DEFAULT_ERROR_MSG = 'Unknown error';

/**
 * Extract a string from the unknown error param to show in the UI
 * @param error unknown or AxiosError type object
 * @param defaultMsg optional default message
 * @returns a string
 */
export function extractErrorMessage(error: unknown, defaultMsg: string = DEFAULT_ERROR_MSG): string {
  // if is already a string, return it
  if (typeof error === 'string') return error;

  // this should be last
  if (error instanceof Error) return error.message;

  return defaultMsg;
}

export type TransactionHistory = {
  tx_hash: string;
  height: number;
}[];

export interface BlockHeader {
  version: number;
  previousBlockHash: string;
  merkleRoot: string;
  timestamp: number;
  height: number;
}

export type Unspent = Omit<Utxo, 'scriptDetails'>;

export interface ChainSource {
  subscribeScriptStatus(script: Buffer, callback: (scripthash: string, status: string | null) => void): Promise<void>;
  unsubscribeScriptStatus(script: Buffer): Promise<void>;
  fetchHistories(scripts: Buffer[]): Promise<TransactionHistory[]>;
  fetchTransactions(txids: string[]): Promise<{ txID: string; hex: string }[]>;
  fetchBlockHeaders(heights: number[]): Promise<BlockHeader[]>;
  estimateFees(targetNumberBlocks: number): Promise<number>;
  broadcastTransaction(hex: string): Promise<string>;
  getRelayFee(): Promise<number>;
  close(): Promise<void>;
  waitForAddressReceivesTx(addr: string): Promise<void>;
  listUnspents(addr: string): Promise<Unspent[]>;
}

export class WsElectrumChainSource implements ChainSource {
  constructor(private ws: ElectrumWS) {}

  async fetchTransactions(txids: string[]): Promise<{ txID: string; hex: string }[]> {
    const requests = txids.map((txid) => ({ method: GetTransactionMethod, params: [txid] }));
    for (let i = 0; i < MAX_FETCH_TRANSACTIONS_ATTEMPTS; i++) {
      try {
        const responses = await this.ws.batchRequest<string[]>(...requests);
        return responses.map((hex, i) => ({ txID: txids[i], hex }));
      } catch (e) {
        if (extractErrorMessage(e).includes(MISSING_TRANSACTION)) {
          console.warn('missing transaction error, retrying');
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        throw e;
      }
    }
    throw new Error('Unable to fetch transactions: ' + txids);
  }

  async unsubscribeScriptStatus(script: Buffer): Promise<void> {
    await this.ws.unsubscribe(SubscribeStatusMethod, toScriptHash(script)).catch();
  }

  async subscribeScriptStatus(script: Buffer, callback: (scripthash: string, status: string | null) => void) {
    const scriptHash = toScriptHash(script);
    await this.ws.subscribe(
      SubscribeStatusMethod,
      (scripthash: unknown, status: unknown) => {
        if (scripthash === scriptHash) {
          callback(scripthash, status as string | null);
        }
      },
      scriptHash
    );
  }

  async fetchHistories(scripts: Buffer[]): Promise<TransactionHistory[]> {
    const scriptsHashes = scripts.map((s) => toScriptHash(s));
    const responses = await this.ws.batchRequest<TransactionHistory[]>(...scriptsHashes.map((s) => ({ method: GetHistoryMethod, params: [s] })));
    return responses;
  }

  async fetchBlockHeaders(heights: number[]): Promise<BlockHeader[]> {
    const responses = await this.ws.batchRequest<string[]>(...heights.map((h) => ({ method: GetBlockHeader, params: [h] })));

    return responses.map(deserializeBlockHeader);
  }

  async estimateFees(targetNumberBlocks: number): Promise<number> {
    const feeRate = await this.ws.request<number>(EstimateFee, targetNumberBlocks);
    return feeRate;
  }

  async broadcastTransaction(hex: string): Promise<string> {
    return this.ws.request<string>(BroadcastTransaction, hex);
  }

  async getRelayFee(): Promise<number> {
    return this.ws.request<number>(GetRelayFeeMethod);
  }

  async close() {
    try {
      await this.ws.close('close');
    } catch (e) {
      console.debug('error closing ws:', e);
    }
  }

  waitForAddressReceivesTx(addr: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.subscribeScriptStatus(address.toOutputScript(addr), (_, status) => {
        if (status !== null) {
          resolve();
        }
      }).catch(reject);
    });
  }

  async listUnspents(addr: string): Promise<Unspent[]> {
    const scriptHash = toScriptHash(address.toOutputScript(addr));
    const unspentsFromElectrum = await this.ws.request<UnspentElectrum[]>(ListUnspentMethod, scriptHash);
    const txs = await this.fetchTransactions(unspentsFromElectrum.map((u) => u.tx_hash));

    return unspentsFromElectrum.map((u, index) => {
      return {
        txid: u.tx_hash,
        vout: u.tx_pos,
        witnessUtxo: Transaction.fromHex(txs[index].hex).outs[u.tx_pos],
      };
    });
  }
}

function toScriptHash(script: Buffer): string {
  return crypto.sha256(script).reverse().toString('hex');
}

// asset-registry.ts

type ExplorerType = 'Blockstream' | 'Testnet' | 'Mempool' | 'Nigiri' | 'Custom';

interface ExplorerURLs {
  type: ExplorerType;
  webExplorerURL: string;
  websocketExplorerURL: string; // ws:// or wss:// endpoint
}

const BlockstreamExplorerURLs: ExplorerURLs = {
  type: 'Blockstream',
  webExplorerURL: 'https://blockstream.info/liquid',
  websocketExplorerURL: 'wss://blockstream.info/liquid/electrum-websocket/api',
};

const BlockstreamTestnetExplorerURLs: ExplorerURLs = {
  type: 'Blockstream',
  webExplorerURL: 'https://blockstream.info/liquidtestnet',
  websocketExplorerURL: 'wss://blockstream.info/liquidtestnet/electrum-websocket/api',
};

function getDefaultAssetEndpoint(network: NetworkString) {
  switch (network) {
    case 'liquid':
      return BlockstreamExplorerURLs.webExplorerURL + '/api/asset';
    case 'testnet':
      return BlockstreamTestnetExplorerURLs.webExplorerURL + '/api/asset';
    case 'regtest':
      return 'http://localhost:3001/asset';
    default:
      throw new Error('Invalid network');
  }
}

export interface AssetRegistry {
  getAsset(assetId: string): Promise<Asset>;
}

export class DefaultAssetRegistry implements AssetRegistry {
  static NOT_FOUND_ERROR_LOCKTIME = 60 * 1000 * 60; // 1 hour
  private assetsLocker: Map<string, number> = new Map();
  private endpoint: string;

  constructor(network: NetworkString) {
    this.endpoint = getDefaultAssetEndpoint(network);
  }

  private isLocked(assetHash: string): boolean {
    const lock = this.assetsLocker.get(assetHash);
    return !!(lock && lock > Date.now());
  }

  private async fetchAssetDetails(assetHash: string): Promise<Asset> {
    const response = await fetch(`${this.endpoint}/${assetHash}`);

    if (!response.ok) {
      // if 404, set a lock on that asset for 1 hour
      if (response.status === 404) {
        this.assetsLocker.set(assetHash, Date.now() + DefaultAssetRegistry.NOT_FOUND_ERROR_LOCKTIME);
      }
      return {
        name: 'Unknown',
        ticker: assetHash.substring(0, 4),
        precision: 8,
        assetHash,
      };
    }

    const { name, ticker, precision } = await response.json();
    return {
      name: name ?? 'Unknown',
      ticker: ticker ?? assetHash.substring(0, 4),
      precision: precision ?? 8,
      assetHash,
    };
  }

  getAsset(assetHash: string): Promise<Asset> {
    try {
      if (this.isLocked(assetHash)) throw new Error('Asset locked'); // fallback to catch block
      this.assetsLocker.delete(assetHash);
      return this.fetchAssetDetails(assetHash);
    } catch (e) {
      return Promise.resolve({
        name: 'Unknown',
        ticker: assetHash.substring(0, 4),
        precision: 8,
        assetHash,
      });
    }
  }
}

function estimateScriptSigSize(type: address.ScriptType): number {
  switch (type) {
    case address.ScriptType.P2Pkh:
      return 108;
    case address.ScriptType.P2Sh:
    case address.ScriptType.P2Wsh:
      return 35;
    case address.ScriptType.P2Tr:
    case address.ScriptType.P2Wpkh:
      return 1; // one byte for the variable len encoding (varlen(0) = 1 byte)
    default:
      return 0;
  }
}

const INPUT_BASE_SIZE = 40; // 32 bytes for outpoint, 4 bytes for sequence, 4 for index
const UNCONFIDENTIAL_OUTPUT_SIZE = 33 + 9 + 1 + 1; // 33 bytes for value, 9 bytes for asset, 1 byte for nonce, 1 byte for script length

function txBaseSize(inScriptSigsSize: number[], outNonWitnessesSize: number[]): number {
  const inSize = inScriptSigsSize.reduce((a, b) => a + b + INPUT_BASE_SIZE, 0);
  const outSize = outNonWitnessesSize.reduce((a, b) => a + b, 0);
  return 9 + varuint.encodingLength(inScriptSigsSize.length) + inSize + varuint.encodingLength(outNonWitnessesSize.length + 1) + outSize;
}

function txWitnessSize(inWitnessesSize: number[], outWitnessesSize: number[]): number {
  const inSize = inWitnessesSize.reduce((a, b) => a + b, 0);
  const outSize = outWitnessesSize.reduce((a, b) => a + b, 0) + 1 + 1; // add the size of proof for unconf fee output
  return inSize + outSize;
}

// estimate pset virtual size after signing, take confidential outputs into account
// aims to estimate the fee amount needed to be paid before blinding or signing the pset
export function estimateVirtualSize(pset: Pset, withFeeOutput: boolean): number {
  const inScriptSigsSize = [];
  const inWitnessesSize = [];
  for (const input of pset.inputs) {
    const utxo = input.getUtxo();
    if (!utxo) throw new Error('missing input utxo, cannot estimate pset virtual size');
    const type = address.getScriptType(utxo.script);
    const scriptSigSize = estimateScriptSigSize(type);
    let witnessSize = 1 + 1 + 1; // add no issuance proof + no token proof + no pegin
    if (input.redeemScript) {
      // get multisig
      witnessSize += varSliceSize(input.redeemScript);
      const pay = payments.p2ms({ output: input.redeemScript });
      if (pay && pay.m) {
        witnessSize += pay.m * 75 + pay.m - 1;
      }
    } else {
      // len + witness[sig, pubkey]
      witnessSize += 1 + 107;
    }
    inScriptSigsSize.push(scriptSigSize);
    inWitnessesSize.push(witnessSize);
  }

  const outSizes = [];
  const outWitnessesSize = [];
  for (const output of pset.outputs) {
    let outSize = 33 + 9 + 1; // asset + value + empty nonce
    let witnessSize = 1 + 1; // no rangeproof + no surjectionproof
    if (output.needsBlinding()) {
      outSize = 33 + 33 + 33; // asset commitment + value commitment + nonce
      witnessSize = 3 + 4174 + 1 + 131; // rangeproof + surjectionproof + their sizes
    }
    outSizes.push(outSize);
    outWitnessesSize.push(witnessSize);
  }

  if (withFeeOutput) {
    outSizes.push(UNCONFIDENTIAL_OUTPUT_SIZE);
    outWitnessesSize.push(1 + 1); // no rangeproof + no surjectionproof
  }

  const baseSize = txBaseSize(inScriptSigsSize, outSizes);
  const sizeWithWitness = baseSize + txWitnessSize(inWitnessesSize, outWitnessesSize);
  const weight = baseSize * 3 + sizeWithWitness;
  return (weight + 3) / 4;
}

function createP2WKHScript(publicKey: Buffer, network: networks.Network): Buffer {
  const buf = payments.p2wpkh({ pubkey: publicKey, network: network }).output;
  if (!buf) throw new Error('Could not create p2wpkh script');
  return buf;
}

// extract p2wpkh scriptPubKey from the first derivation path found in the input
export function extractScriptFromBIP32Derivation(input: Pset['inputs'][number], network: networks.Network): Buffer | undefined {
  const derivation = input.bip32Derivation?.at(0);
  if (!derivation) return;
  return createP2WKHScript(derivation.pubkey, network);
}
