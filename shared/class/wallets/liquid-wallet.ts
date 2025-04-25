import ZKPLib from '@vulpemventures/secp256k1-zkp';
import BigNumber from 'bignumber.js';
import BIP32Factory, { BIP32Interface } from 'bip32';
import { mnemonicToSeedSync } from 'bip39';
import coinselect from 'coinselect';
import {
  AssetHash,
  Blinder,
  Creator,
  Extractor,
  Finalizer,
  OwnedInput,
  Pset,
  Secp256k1Interface,
  Signer,
  Transaction,
  TxOutput,
  Updater,
  UpdaterInput,
  UpdaterOutput,
  ZKPGenerator,
  ZKPValidator,
  address,
  confidential,
  networks,
  payments,
  script,
} from 'liquidjs-lib';
import { confidentialValueToSatoshi } from 'liquidjs-lib/src/confidential';
import { SLIP77Factory, Slip77Interface } from 'slip77';
import { ElectrumWS } from 'ws-electrumx-client';
import ecc from '../../blue_modules/noble_ecc';
import { Networks } from '../../types/networks';
import { AbstractHDElectrumWallet } from './abstract-hd-electrum-wallet';
import { DefaultAssetRegistry, WsElectrumChainSource, estimateVirtualSize, extractScriptFromBIP32Derivation, h2b, isConfidentialOutput, scriptDetailsWithKeyToAddress } from './liquid-deps/helpers';
import type {
  Address,
  AddressRecipient,
  Asset,
  CoinSelection,
  DataRecipient,
  NetworkString,
  Outpoint,
  PubKeyWithRelativeDerivationPath,
  ScriptDetails,
  TxDetails,
  UnblindedOutput,
  UnblindingData,
} from './liquid-deps/types';
import { AccountType, CoinSelectionError } from './liquid-deps/types';

const bip32 = BIP32Factory(ecc);
const slip77 = SLIP77Factory(ecc);

export const lbtcAssetId: Partial<Record<Networks, string>> = {
  liquid: '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d',
  liquidtest: '144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49',
};

export class LiquidWallet extends AbstractHDElectrumWallet {
  static readonly type = 'LiquidWallet';
  static readonly typeReadable = 'Liquid';
  // @ts-ignore: override
  public readonly type = LiquidWallet.type;
  // @ts-ignore: override
  public readonly typeReadable = LiquidWallet.typeReadable;
  public readonly segwitType = 'p2wpkh';

  // static readonly derivationPath = "m/84'/1'/0'"; // testnet
  static readonly derivationPath = "m/84'/1776'/0'"; // mainnet

  public network: networks.Network = networks.liquid;
  public networkString: NetworkString = 'liquid';
  public masterBlindingKey?: string;
  private zkpLib?: Secp256k1Interface;
  private liquidAccoutType = AccountType.P2WPKH;
  public blindingKeyNode?: Slip77Interface;
  public confidentialLib?: confidential.Confidential;
  public wsURL: string;
  public wsclient?: ElectrumWS;
  public chainSource?: WsElectrumChainSource;
  public name: string;
  public scripts: string[] = [];
  public scriptsDetails: Record<string, ScriptDetails> = {};
  public txIDs: string[] = [];
  public txDetails: Record<string, TxDetails> = {};
  public outpointBlindingData: Record<string, UnblindingData> = {};
  public assetRegistry: Record<string, Asset> = {};

  constructor(networkString: NetworkString = 'liquid', connect: boolean = true) {
    super();
    this.networkString = networkString;
    this.network = networks[networkString];
    if (networkString === 'testnet') {
      this._derivationPath = "m/84'/1'/0'";
    } else {
      this._derivationPath = "m/84'/1776'/0'";
    }
    this._enable_BIP47 = false;
    this.name = 'mainAccountTest';
    this.wsURL = networkString === 'liquid' ? 'wss://blockstream.info/liquid/electrum-websocket/api' : 'wss://blockstream.info/liquidtestnet/electrum-websocket/api';
    if (connect) {
      this.connect();
    }
  }

  connect() {
    this.wsclient = new ElectrumWS(this.wsURL, { reconnect: true });
    this.chainSource = new WsElectrumChainSource(this.wsclient);
  }

  async init(props: { mnemonic: string } | { xpub: string; masterBlindingKey: string }) {
    this.zkpLib = await ZKPLib();
    this.confidentialLib = new confidential.Confidential(this.zkpLib);
    if ('mnemonic' in props) {
      this.setSecret(props.mnemonic);
      const seed = mnemonicToSeedSync(props.mnemonic).toString('hex'); // slip77.fromSeed does not like Uint8Array
      this.masterBlindingKey = slip77.fromSeed(seed).masterKey.toString('hex');
    } else {
      this._xpub = props.xpub;
      this.masterBlindingKey = props.masterBlindingKey;
    }
    this.blindingKeyNode = slip77.fromMasterBlindingKey(this.masterBlindingKey);
  }

  public generateXpubAndMasterBlindingKey(mnemonic: string): { xpub: string; masterBlindingKey: string } {
    const seed = mnemonicToSeedSync(mnemonic);
    const hexSeed = seed.toString('hex'); // slip77.fromSeed does not like Uint8Array
    const masterBlindingKey = slip77.fromSeed(hexSeed).masterKey.toString('hex');
    const root = bip32.fromSeed(seed);
    const path = this.getDerivationPath();
    if (!path) {
      throw new Error('Internal error: no path');
    }
    const child = root.derivePath(path).neutered();
    const xpub = child.toBase58();
    return { xpub, masterBlindingKey };
  }

  private deriveBlindingKey(script: Buffer): { publicKey: Buffer; privateKey: Buffer } {
    if (!this.blindingKeyNode) throw new Error('No blinding key node, Account cannot derive blinding key');
    const derived = this.blindingKeyNode.derive(script);
    if (!derived.publicKey || !derived.privateKey) throw new Error('Could not derive blinding key');
    return { publicKey: derived.publicKey, privateKey: derived.privateKey };
  }

  getMasterBlindingKey(): string {
    if (!this.masterBlindingKey) throw new Error('Master blinding key not found');
    return this.masterBlindingKey;
  }

  _nodeToBech32SegwitAddress(hdNode: BIP32Interface, confidential = false): string {
    if (!this.zkpLib) {
      throw new Error('ZKPLib not initialized');
    }

    const script = payments.p2wpkh({
      pubkey: hdNode.publicKey,
      network: this.network,
    }).output;

    if (!script) {
      throw new Error('Could not create script');
    }

    const scriptHex = script.toString('hex');
    const scriptDetails = {
      networks: [this.network.name as NetworkString],
      blindingPrivateKey: this.deriveBlindingKey(script).privateKey.toString('hex'),
    } as ScriptDetails;
    const addr = scriptDetailsWithKeyToAddress(this.network, this.liquidAccoutType, this.zkpLib)(scriptHex, scriptDetails, hdNode.publicKey.toString('hex'));

    if (!addr.unconfidentialAddress) {
      throw new Error('Could not create unconfidentialAddress');
    }

    return addr.unconfidentialAddress;
  }

  // Derive a range from start to end index of public keys applying the base derivation path
  private deriveBatchPublicKeys(start: number, end: number, isInternal: boolean): PubKeyWithRelativeDerivationPath[] {
    const results: PubKeyWithRelativeDerivationPath[] = [];
    for (let i = start; i < end; i++) {
      const publicKey = this._getNodePubkeyByIndex(isInternal ? 1 : 0, i);
      results.push({ publicKey, derivationPath: `m/${isInternal ? 1 : 0}/${i}` });
    }
    return results;
  }

  private createP2PWKHScript({ publicKey, derivationPath }: PubKeyWithRelativeDerivationPath): [string, ScriptDetails] {
    const script = payments.p2wpkh({ pubkey: publicKey, network: this.network }).output;
    if (!script) throw new Error('Could not derive script');
    return [
      script.toString('hex'),
      {
        derivationPath,
        accountName: this.name,
        networks: [this.network.name as NetworkString],
        blindingPrivateKey: this.deriveBlindingKey(script).privateKey.toString('hex'),
      },
    ];
  }

  async fetchTransactions() {
    if (!this.chainSource) {
      throw new Error('Wallet is not connected');
    }

    const gapLimit = this.gap_limit;
    const indexes = {
      internal: this.next_free_change_address_index,
      external: this.next_free_address_index,
    };

    const historyTxsId: Set<string> = new Set();
    const txidHeight: Map<string, number | undefined> = new Map();
    let restoredScripts: Record<string, ScriptDetails> = {};
    let tempRestoredScripts: Record<string, ScriptDetails> = {};

    const walletChains = [0, 1];
    for (const i of walletChains) {
      tempRestoredScripts = {};
      const isInternal = i === 1;
      let batchCount = isInternal ? indexes.internal : indexes.external;
      let unusedScriptCounter = 0;

      while (unusedScriptCounter <= gapLimit) {
        const publicKeys = this.deriveBatchPublicKeys(0, batchCount + gapLimit, isInternal);
        const scriptsWithDetails = publicKeys.map((publicKey) => this.createP2PWKHScript(publicKey));

        const scripts = scriptsWithDetails.map(([script]) => h2b(script));
        const histories = await this.chainSource.fetchHistories(scripts);

        for (const [index, history] of histories.entries()) {
          tempRestoredScripts[scriptsWithDetails[index][0]] = scriptsWithDetails[index][1];
          if (history.length > 0) {
            unusedScriptCounter = 0; // reset counter
            // update the restored scripts with all the script details until now
            restoredScripts = { ...restoredScripts, ...tempRestoredScripts };
            tempRestoredScripts = {};
            const newMaxIndex = index + batchCount + 1;
            if (isInternal) indexes.internal = newMaxIndex;
            else indexes.external = newMaxIndex;

            // update the history set
            for (const { tx_hash, height } of history) {
              historyTxsId.add(tx_hash);
              txidHeight.set(tx_hash, height);
            }
          } else {
            unusedScriptCounter += 1;
          }
        }
        batchCount += gapLimit;
      }
    }

    const txIDsToFetch = [...historyTxsId];
    const transactions = await this.chainSource.fetchTransactions(txIDsToFetch);

    const txDetails = Object.fromEntries(transactions.map((tx, i) => [txIDsToFetch[i], tx]));

    // try to unblind the transaction outputs
    const unblindedOutpoints = await this.unblindTxs(...transactions.map(({ hex }) => Transaction.fromHex(hex)));

    const outpointBlindingData: Record<string, UnblindingData> = {};
    for (const [outpoint, unblindingData] of unblindedOutpoints) {
      outpointBlindingData[outpoint.txid + ':' + outpoint.vout] = unblindingData;
    }

    this.outpointBlindingData = outpointBlindingData;
    this.scripts = Object.keys(restoredScripts);
    this.scriptsDetails = restoredScripts;
    this.txIDs = txIDsToFetch;
    this.txDetails = txDetails;
    this.next_free_change_address_index = indexes.internal;
    this.next_free_address_index = indexes.external;
  }

  async unblind(...outputs: TxOutput[]): Promise<(UnblindingData | Error)[]> {
    if (!this.confidentialLib) {
      throw new Error('Confidential lib not initialized');
    }
    const masterBlindingKey = this.masterBlindingKey;
    const network = this.networkString;
    if (!masterBlindingKey) throw new Error('Master blinding key not found');
    const slip77node = slip77.fromMasterBlindingKey(masterBlindingKey);

    const unblindingResults: (UnblindingData | Error)[] = [];

    for (const output of outputs) {
      try {
        if (output.script.length === 0) throw new Error('Empty script: fee output');

        // if output is unconfidential, we don't need to unblind it
        if (!isConfidentialOutput(output)) {
          unblindingResults.push({
            value: confidentialValueToSatoshi(output.value),
            asset: AssetHash.fromBytes(output.asset).hex,
            assetBlindingFactor: Buffer.alloc(32).toString('hex'),
            valueBlindingFactor: Buffer.alloc(32).toString('hex'),
          });
          continue;
        }
        const blindPrivKey = slip77node.derive(output.script).privateKey;
        if (!blindPrivKey) throw new Error('Blinding private key error for script ' + output.script.toString('hex'));

        const unblinded = this.confidentialLib.unblindOutputWithKey(output, blindPrivKey);

        unblindingResults.push({
          value: parseInt(unblinded.value, 10),
          asset: AssetHash.fromBytes(unblinded.asset).hex,
          assetBlindingFactor: unblinded.assetBlindingFactor.toString('hex'),
          valueBlindingFactor: unblinded.valueBlindingFactor.toString('hex'),
        });
      } catch (e: unknown) {
        if (e instanceof Error) {
          unblindingResults.push(e);
        } else {
          unblindingResults.push(new Error('unable to unblind output (unknown error)'));
        }
        continue;
      }
    }

    const defaultAssetRegistry = new DefaultAssetRegistry(network);

    const successfullyUnblinded = unblindingResults.filter((r): r is UnblindingData => !(r instanceof Error));
    const assetSet = new Set<string>(successfullyUnblinded.map((u) => u.asset));
    for (const asset of assetSet) {
      const assetDetails = this.assetRegistry[asset];
      if (assetDetails && assetDetails.ticker !== assetDetails.assetHash.substring(0, 4)) continue;
      const assetFromExplorer = await defaultAssetRegistry.getAsset(asset);
      this.assetRegistry[asset] = assetFromExplorer;
    }

    return unblindingResults;
  }

  async unblindTxs(...txs: Transaction[]): Promise<[Outpoint, UnblindingData][]> {
    const unblindedOutpoints: [Outpoint, UnblindingData][] = [];

    for (const tx of txs) {
      const unblindedResults = await this.unblind(...tx.outs);
      const txid = tx.getId();
      for (const [vout, unblinded] of unblindedResults.entries()) {
        if (unblinded instanceof Error) {
          if (unblinded.message === 'secp256k1_rangeproof_rewind') continue;
          if (unblinded.message === 'Empty script: fee output') continue;
          console.error('Error while unblinding', unblinded);
          continue;
        }
        unblindedOutpoints.push([{ txid, vout }, unblinded]);
      }
    }

    return unblindedOutpoints;
  }

  getUtxos(): UnblindedOutput[] {
    let scripts = this.scripts;
    const walletScripts = scripts.map((s) => Buffer.from(s, 'hex'));
    const txDetails = this.txDetails;

    const outpointsInInputs = new Set<string>();
    const walletOutputs = new Set<string>();

    const transactions = Object.values(txDetails)
      .filter((tx) => tx?.hex)
      .map((tx) => Transaction.fromHex(tx.hex!));
    for (const tx of transactions) {
      for (const input of tx.ins) {
        outpointsInInputs.add(`${Buffer.from(input.hash).reverse().toString('hex')}:${input.index}`);
      }
      for (let i = 0; i < tx.outs.length; i++) {
        if (!walletScripts.find((script) => script.equals(tx.outs[i].script))) continue;
        walletOutputs.add(`${tx.getId()}:${i}`);
      }
    }

    const outpoints = Array.from(walletOutputs)
      .filter((outpoint) => !outpointsInInputs.has(outpoint))
      .map((outpoint) => {
        const [txid, vout] = outpoint.split(':');
        return { txid, vout: Number(vout) };
      });

    const values: Record<string, UnblindingData> = {};
    for (const outpoint of outpoints) {
      const key = outpoint.txid + ':' + outpoint.vout;
      values[key] = this.outpointBlindingData[key];
    }

    const utxos = outpoints.map(({ txid, vout }) => {
      const key = txid + ':' + vout;
      const blindingData = values[key] as UnblindingData | undefined;
      return { txid, vout, blindingData };
    });

    return utxos;
  }

  getBalances(utxos: UnblindedOutput[] = this.getUtxos()): Record<string, number> {
    const balances: Record<string, number> = {};
    for (const utxo of utxos) {
      if (!utxo.blindingData) continue;
      const { asset, value } = utxo.blindingData;
      balances[asset] = (balances[asset] || 0) + value;
    }
    return balances;
  }

  // @ts-ignore: override
  createTransaction(utxos: UnblindedOutput[], relayFee: number, recipients: AddressRecipient[], dataRecipients: DataRecipient[] = []): { pset: Pset; fee: number } {
    const pset = Creator.newPset();
    const feeAssetHash = this.network.assetHash;

    const coinSelection = this.selectUtxos(
      utxos,
      [...recipients, ...dataRecipients].filter(({ value }) => value > 0).map(({ asset, value }) => ({ asset, amount: value }))
    );

    const { ins, outs } = this.createUpdaterInsOuts(coinSelection, recipients, dataRecipients);
    const changeOutputsStartIndex = outs.length;

    // add the changes outputs
    if (coinSelection.changeOutputs && coinSelection.changeOutputs.length > 0) {
      for (const { asset, amount } of coinSelection.changeOutputs) {
        const changeAddress = this.getChangeConfidentialAddress();

        outs.push({
          asset,
          amount,
          script: address.toOutputScript(changeAddress, this.network),
          blinderIndex: 0,
          blindingPublicKey: address.fromConfidential(changeAddress).blindingKey,
        });
      }
    }

    const updater = new Updater(pset).addInputs(ins).addOutputs(outs);

    // we add 10% to the min relay fee in order to be sure that the transaction will be accepted by the network
    // some inputs and outputs may be added later to pay the fees
    const sats1000Bytes = new BigNumber(relayFee).multipliedBy(1.1).multipliedBy(1e8);
    const estimatedSize = estimateVirtualSize(updater.pset, true);
    let feeAmount = new BigNumber(estimatedSize).multipliedBy(sats1000Bytes.dividedBy(1000)).integerValue(BigNumber.ROUND_CEIL).toNumber();

    const newIns = [];
    const newOuts = [];

    // check if one of the change outputs can cover the fees
    const onlyChangeOuts = outs.slice(changeOutputsStartIndex);
    const lbtcChangeOutputIndex = onlyChangeOuts.findIndex((out) => out.asset === feeAssetHash && out.amount >= feeAmount);

    if (lbtcChangeOutputIndex !== -1) {
      pset.outputs[changeOutputsStartIndex + lbtcChangeOutputIndex].value -= feeAmount;
      // add the fee output
      updater.addOutputs([
        {
          asset: feeAssetHash,
          amount: feeAmount,
        },
      ]);
    } else {
      // reselect utxos to pay the fees
      const newCoinSelection = this.selectUtxos(
        utxos,
        [{ asset: this.network.assetHash, amount: feeAmount }],
        // exclude the already selected utxos used in the pset inputs
        updater.pset.inputs.map((input) => ({
          txid: Buffer.from(input.previousTxid).reverse().toString('hex'),
          vout: input.previousTxIndex,
        }))
      );

      const newWitnessUtxos: TxOutput[] = [];
      for (const [txid, txDetails] of Object.entries(this.txDetails)) {
        if (!txDetails.hex) continue;
        for (const utxo of newCoinSelection.utxos) {
          if (utxo.txid === txid) {
            const output = Transaction.fromHex(txDetails.hex).outs[utxo.vout];
            newWitnessUtxos.push(output);
          }
        }
      }

      newIns.push(
        ...newCoinSelection.utxos.map((utxo, i) => ({
          txid: utxo.txid,
          txIndex: utxo.vout,
          sighashType: Transaction.SIGHASH_ALL,
          witnessUtxo: newWitnessUtxos[i],
        }))
      );

      if (newCoinSelection.changeOutputs && newCoinSelection.changeOutputs.length > 0) {
        const changeAddress = this.getChangeConfidentialAddress();
        newOuts.push({
          asset: newCoinSelection.changeOutputs[0].asset,
          amount: newCoinSelection.changeOutputs[0].amount,
          script: address.toOutputScript(changeAddress, this.network),
          blinderIndex: 0,
          blindingPublicKey: address.fromConfidential(changeAddress).blindingKey,
        });

        const outputIndex = pset.globals.outputCount;

        // reversing the array ensures that the fee output is the last one for consistency
        newOuts.reverse();
        updater.addInputs(newIns).addOutputs(newOuts);

        // re-estimate the size with new selection
        const estimatedSize = estimateVirtualSize(updater.pset, true);
        const newfeeAmount = new BigNumber(estimatedSize).multipliedBy(sats1000Bytes.dividedBy(1000)).integerValue(BigNumber.ROUND_CEIL).toNumber();

        const diff = newfeeAmount - feeAmount;

        // deduce from change output if possible
        if (pset.outputs[outputIndex].value > diff) {
          pset.outputs[outputIndex].value -= diff;
          feeAmount = newfeeAmount;
        } else {
          // if change cannot cover the fee, remove it and add it to the fee output
          feeAmount += pset.outputs[outputIndex].value;
          pset.outputs.splice(outputIndex, 1);
        }

        // add the fee output
        updater.addOutputs([
          {
            asset: feeAssetHash,
            amount: feeAmount,
          },
        ]);
      }
    }

    return { fee: feeAmount, pset: updater.pset };
  }

  public signAndFinalize(pset: Pset, mnemonic: string): { pset: Pset; tx: string } {
    const blindedPset = this.blindPset(pset);
    const signedPset = this.signPset(blindedPset, mnemonic);
    return this.finalizeAndExtract(signedPset);
  }

  selectUtxos(_utxos: UnblindedOutput[], targets: { amount: number; asset: string }[], excludeOutpoints: Outpoint[] = []): CoinSelection {
    const utxos = _utxos.filter((utxo) => utxo.blindingData && !excludeOutpoints.find(({ txid, vout }) => utxo.txid === txid && utxo.vout === vout));

    const balances = this.getBalances(utxos);
    // accumulate targets with same asset
    targets = targets.reduce(
      (acc, target) => {
        const existingTarget = acc.find((t) => t.asset === target.asset);
        if (existingTarget) {
          existingTarget.amount += target.amount;
        } else {
          acc.push(target);
        }
        return acc;
      },
      [] as { amount: number; asset: string }[]
    );

    const selectedUtxos: UnblindedOutput[] = [];
    const changeOutputs: { asset: string; amount: number }[] = [];
    for (const target of targets) {
      const utxosFilteredByAsset = utxos.filter((utxo) => utxo.blindingData?.asset === target.asset);
      const isSendAll = target.amount === balances[target.asset];
      const { inputs, outputs } = coinselect(
        utxosFilteredByAsset.map((utxo) => ({
          txid: utxo.txid,
          vout: utxo.vout,
          value: utxo.blindingData?.value ?? 0,
        })),
        [{ address: 'fake', value: isSendAll ? undefined : target.amount }],
        0
      );

      if (inputs) {
        selectedUtxos.push(...(inputs as { txid: string; vout: number }[]).map((input) => utxos.find((utxo) => utxo.txid === input.txid && utxo.vout === input.vout) as UnblindedOutput));
      }

      if (outputs) {
        changeOutputs.push(
          ...outputs
            .filter((output: any) => output.address === undefined) // only add change outputs
            .map((output: { value: number }) => ({
              asset: target.asset,
              amount: output.value,
            }))
        );
      }
    }

    // check if we have enough utxos for each target
    // throw CoinSelectionError if not
    for (const { amount, asset } of targets) {
      const selectedAmount = selectedUtxos.reduce((acc, utxo) => (utxo.blindingData?.asset === asset ? acc + utxo.blindingData.value : acc), 0);
      if (selectedAmount < amount) {
        throw new CoinSelectionError({ amount, asset }, selectedAmount);
      }
    }

    return {
      utxos: selectedUtxos,
      changeOutputs,
    };
  }

  private createUpdaterInsOuts(coinSelection: CoinSelection, recipients: AddressRecipient[], dataRecipients: DataRecipient[]) {
    const ins: UpdaterInput[] = [];
    const outs: UpdaterOutput[] = [];
    const utxosWitnessUtxos: TxOutput[] = [];

    for (const [txid, txDetails] of Object.entries(this.txDetails)) {
      if (!txDetails.hex) continue;
      for (const utxo of coinSelection.utxos) {
        if (utxo.txid === txid) {
          const output = Transaction.fromHex(txDetails.hex).outs[utxo.vout];
          utxosWitnessUtxos.push(output);
        }
      }
    }

    ins.push(
      ...coinSelection.utxos.map((utxo, i) => ({
        txid: utxo.txid,
        txIndex: utxo.vout,
        sighashType: Transaction.SIGHASH_ALL,
        witnessUtxo: utxosWitnessUtxos[i],
      }))
    );

    // add recipients
    for (const recipient of recipients) {
      const updaterOut: UpdaterOutput = {
        asset: recipient.asset,
        amount: recipient.value,
        script: address.toOutputScript(recipient.address),
      };
      if (address.isConfidential(recipient.address)) {
        updaterOut.blinderIndex = 0;
        updaterOut.blindingPublicKey = address.fromConfidential(recipient.address).blindingKey;
      }
      outs.push(updaterOut);
    }

    // add data (OP_RETURN) recipients
    for (const dataRecipient of dataRecipients) {
      const opReturnPayment = payments.embed({ data: [Buffer.from(dataRecipient.data, 'hex')] });
      const updaterOut: UpdaterOutput = {
        asset: dataRecipient.asset,
        amount: dataRecipient.value,
        script: opReturnPayment.output,
      };
      outs.push(updaterOut);
    }

    return { ins, outs };
  }

  getLiquidAddressByIndex(node: 0 | 1, index: number): Address {
    if (!this.zkpLib) {
      throw new Error('ZKPLib not initialized');
    }
    const hdNode = this._getNodeByIndex(node, index);
    const script = payments.p2wpkh({
      pubkey: hdNode.publicKey,
      network: this.network,
    }).output;
    if (!script) {
      throw new Error('Could not create script');
    }

    const scriptHex = script.toString('hex');
    const scriptDetails = {
      networks: [this.network.name as NetworkString],
      blindingPrivateKey: this.deriveBlindingKey(script).privateKey.toString('hex'),
    } as ScriptDetails;
    return scriptDetailsWithKeyToAddress(this.network, this.liquidAccoutType, this.zkpLib)(scriptHex, scriptDetails, hdNode.publicKey.toString('hex'));
  }

  public getChangeConfidentialAddress(): string {
    const addr = this.getLiquidAddressByIndex(1, this.next_free_change_address_index);
    if (!addr.confidentialAddress) {
      throw new Error('Could not create confidentialAddress');
    }
    return addr.confidentialAddress;
  }

  blindPset(pset: Pset): Pset {
    if (!this.zkpLib) {
      throw new Error('ZKPLib not initialized');
    }
    const zkpValidator = new ZKPValidator(this.zkpLib);
    const ownedInputs: OwnedInput[] = [];

    const inputsBlindingData: UnblindedOutput[] = [];
    for (const input of pset.inputs) {
      const txid = Buffer.from(input.previousTxid).reverse().toString('hex');
      const vout = input.previousTxIndex;
      const key = txid + ':' + vout;
      inputsBlindingData.push({
        txid,
        vout,
        blindingData: this.outpointBlindingData[key],
      });
    }

    for (const inputIndex of pset.inputs.keys()) {
      const unblindOutput = inputsBlindingData.at(inputIndex);
      if (!unblindOutput || !unblindOutput.blindingData) continue;
      ownedInputs.push({
        asset: AssetHash.fromHex(unblindOutput.blindingData.asset).bytesWithoutPrefix,
        assetBlindingFactor: Buffer.from(unblindOutput.blindingData.assetBlindingFactor, 'hex'),
        valueBlindingFactor: Buffer.from(unblindOutput.blindingData.valueBlindingFactor, 'hex'),
        value: unblindOutput.blindingData.value.toString(),
        index: inputIndex,
      });
    }

    const zkpGenerator = new ZKPGenerator(this.zkpLib, ZKPGenerator.WithOwnedInputs(ownedInputs));

    // find the output indexes to blind
    const outputIndexes = [];
    for (const [index, output] of pset.outputs.entries()) {
      if (output.blindingPubkey && output.blinderIndex) {
        outputIndexes.push(index);
      }
    }

    const outputBlindingArgs = zkpGenerator.blindOutputs(pset, Pset.ECCKeysGenerator(this.zkpLib.ecc), outputIndexes);
    const inputIndexes = ownedInputs.map((input) => input.index);
    let isLast = true;
    for (const out of pset.outputs) {
      if (out.isFullyBlinded()) continue;
      if (out.needsBlinding() && out.blinderIndex) {
        if (!inputIndexes.includes(out.blinderIndex)) {
          isLast = false;
          break;
          // if it remains an output to blind, it means that we are not the last blinder
        }
      }
    }

    const blinder = new Blinder(pset, ownedInputs, zkpValidator, zkpGenerator);
    if (isLast) {
      blinder.blindLast({ outputBlindingArgs });
    } else {
      blinder.blindNonLast({ outputBlindingArgs });
    }

    return blinder.pset;
  }

  signPset(pset: Pset, mnemonic: string): Pset {
    if (!this.zkpLib) {
      throw new Error('ZKPLib not initialized');
    }

    const seed = mnemonicToSeedSync(mnemonic);
    const root = bip32.fromSeed(seed);

    const inputsScripts = pset.inputs.flatMap((input) => [input.witnessUtxo?.script, extractScriptFromBIP32Derivation(input, this.network)]).filter((script) => !!script);

    const scriptsDetails: Record<string, ScriptDetails> = {};
    for (const script of inputsScripts) {
      const scriptHex = script!.toString('hex');
      scriptsDetails[scriptHex] = this.scriptsDetails[scriptHex];
    }

    const signer = new Signer(pset);
    for (const [index, input] of signer.pset.inputs.entries()) {
      if (!input.witnessUtxo && !input.nonWitnessUtxo) continue;
      const scriptFromDerivation = extractScriptFromBIP32Derivation(input, this.network);
      if (!scriptFromDerivation && !input.witnessUtxo) continue;
      const scriptDetails = scriptFromDerivation ? scriptsDetails[scriptFromDerivation?.toString('hex')] : scriptsDetails[input.witnessUtxo!.script.toString('hex')];
      if (!scriptDetails || !scriptDetails.derivationPath) continue;

      const key = root
        // .derivePath(inputAccount.baseDerivationPath)
        .derivePath(this.getDerivationPath()!)
        .derivePath(scriptDetails.derivationPath.replace('m/', '')!);

      switch (this.liquidAccoutType) {
        case AccountType.P2WPKH: {
          const sighash = input.sighashType || Transaction.SIGHASH_ALL; // '||' lets to overwrite SIGHASH_DEFAULT (0x00)
          const signature = key.sign(pset.getInputPreimage(index, sighash));
          const ecc = this.zkpLib.ecc;
          signer.addSignature(
            index,
            {
              partialSig: {
                pubkey: key.publicKey,
                signature: script.signature.encode(signature, sighash),
              },
            },
            Pset.ECDSASigValidator(ecc)
          );
          break;
        }
        default:
          throw new Error('Unsupported account type');
      }
    }
    return signer.pset;
  }

  finalizeAndExtract(pset: Pset): { pset: Pset; tx: string } {
    const finalizer = new Finalizer(pset);
    finalizer.finalize();
    return {
      pset: finalizer.pset,
      tx: Extractor.extract(finalizer.pset).toHex(),
    };
  }

  public async getAddressAsync(): Promise<string> {
    if (!this.chainSource) {
      throw new Error('Wallet is not connected');
    }
    const batchCount = this.next_free_address_index;
    const publicKeys = this.deriveBatchPublicKeys(batchCount, batchCount + this.gap_limit, false);
    const scriptsWithDetails = publicKeys.map((publicKey) => this.createP2PWKHScript(publicKey));
    const scripts = scriptsWithDetails.map(([script]) => h2b(script));
    const histories = await this.chainSource.fetchHistories(scripts);

    for (const [index, history] of histories.entries()) {
      if (history.length > 0) {
        continue;
      }
      const address = this.getLiquidAddressByIndex(0, batchCount + index).confidentialAddress!;
      this.next_free_address_index += index + 1;
      return address;
    }

    const address = this.getLiquidAddressByIndex(0, batchCount + this.gap_limit).confidentialAddress!;
    this.next_free_address_index += this.gap_limit + 1;
    return address;
  }

  public isAddressValid(addr: string): boolean {
    try {
      address.toOutputScript(addr, this.network);
      return true;
    } catch (ignore) {
      return false;
    }
  }
}
