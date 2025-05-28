import type * as JSAPI from '@breeztech/breez-sdk-liquid';
import * as RNAPI from '@breeztech/react-native-breez-sdk-liquid';
import * as Crypto from 'expo-crypto';

import { BreezConnection, IBreezAdapter, assetMetadata } from '@shared/class/wallets/breez-wallet';
import { NETWORK_BREEZ, NETWORK_BREEZTESTNET } from '@shared/types/networks';

const API_KEY = process.env.EXPO_PUBLIC_BREEZ_API_KEY;

/**
 * The Breez SDK comes in two packages with slightly different type definitions:
 * - @breeztech/breez-sdk-liquid (JS/Web version)
 * - @breeztech/react-native-breez-sdk-liquid (React Native version)
 *
 * We need converter functions to transform between these two APIs since we use
 * the JS types in our shared code but need to convert to RN types when making
 * actual SDK calls on mobile.
 */
const convertReceiveAmount = (amount?: JSAPI.ReceiveAmount): RNAPI.ReceiveAmount | undefined => {
  if (!amount) {
    return undefined;
  } else if (amount.type === 'bitcoin') {
    return { type: RNAPI.ReceiveAmountVariant.BITCOIN, payerAmountSat: amount.payerAmountSat };
  } else if (amount.type === 'asset') {
    return { type: RNAPI.ReceiveAmountVariant.ASSET, assetId: amount.assetId, payerAmount: amount.payerAmount };
  } else {
    throw new Error(`Unsupported amount type: ${amount}`);
  }
};

const convertPayAmount = (amount?: JSAPI.PayAmount): RNAPI.PayAmount | undefined => {
  if (!amount) {
    return undefined;
  }
  switch (amount.type) {
    case 'bitcoin':
      return {
        type: RNAPI.PayAmountVariant.BITCOIN,
        receiverAmountSat: amount.receiverAmountSat,
      };
    case 'asset':
      return {
        type: RNAPI.PayAmountVariant.ASSET,
        assetId: amount.assetId,
        receiverAmount: amount.receiverAmount,
        estimateAssetFees: amount.estimateAssetFees,
      };
    default:
      throw new Error(`Unsupported pay amount type: ${amount.type}`);
  }
};

const convertPaymentMethod = (method: JSAPI.PaymentMethod): RNAPI.PaymentMethod => {
  switch (method) {
    case 'lightning':
      return RNAPI.PaymentMethod.LIGHTNING;
    case 'bitcoinAddress':
      return RNAPI.PaymentMethod.BITCOIN_ADDRESS;
    case 'liquidAddress':
      return RNAPI.PaymentMethod.LIQUID_ADDRESS;
    default:
      throw new Error(`Unsupported payment method: ${method}`);
  }
};

const convertNetwork = (network: JSAPI.LiquidNetwork): RNAPI.LiquidNetwork => {
  switch (network) {
    case 'mainnet':
      return RNAPI.LiquidNetwork.MAINNET;
    case 'testnet':
      return RNAPI.LiquidNetwork.TESTNET;
    case 'regtest':
      return RNAPI.LiquidNetwork.REGTEST;
    default:
      throw new Error(`Unsupported network: ${network}`);
  }
};

const convertPrepareResponse = (response: JSAPI.PrepareReceiveResponse): RNAPI.PrepareReceiveResponse => {
  return {
    paymentMethod: convertPaymentMethod(response.paymentMethod),
    feesSat: response.feesSat,
    amount: convertReceiveAmount(response.amount),
  };
};

const sha256 = async (mnemonic: string): Promise<string> => {
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, mnemonic);
};

class BreezAdapter implements IBreezAdapter {
  private initialized: boolean = false;
  private cc: BreezConnection | undefined;
  private sdkLock: Promise<void> = Promise.resolve();

  // This function is used to ensure that the SDK is initialized before calling the function
  // It also ensures that the SDK is not initialized multiple times at the same times
  private withLockAndSdk<T, Args extends any[]>(fn: (...args: Args) => Promise<T>): (connection: BreezConnection, ...args: Args) => Promise<T> {
    return async (connection: BreezConnection, ...args: Args): Promise<T> => {
      let releaseLock: () => void = () => {};
      const lockPromise = new Promise<void>((resolve) => (releaseLock = resolve));
      await this.sdkLock; // Wait for any ongoing SDK initialization to complete
      this.sdkLock = lockPromise; // Set new lock

      try {
        await this.getSdk(connection);
        return await fn(...args);
      } finally {
        releaseLock();
      }
    };
  }

  private async getSdk(connection: BreezConnection) {
    if (connection.mnemonic === this.cc?.mnemonic && connection.network === this.cc?.network) {
      return;
    }
    if (this.initialized) {
      await RNAPI.disconnect();
    }
    const newNetwork = convertNetwork(connection.network);
    const config = await RNAPI.defaultConfig(newNetwork, API_KEY);
    // set the working directory to a unique path based on the mnemonic
    config.workingDir = `${config.workingDir}/${sha256(connection.mnemonic)}`;
    // set the asset metadata
    config.assetMetadata = assetMetadata;
    try {
      await RNAPI.connect({ mnemonic: connection.mnemonic, config });
    } catch (e: any) {
      // because of the RN hot reload we might sometimes lose this.initialized state
      // in this case, we need to disconnect and try again
      if (e?.message?.includes('Already initialized')) {
        await RNAPI.disconnect();
        await RNAPI.connect({ mnemonic: connection.mnemonic, config });
      } else {
        throw e;
      }
    }

    this.cc = connection;
    this.initialized = true;
  }

  private async getInfo() {
    return await RNAPI.getInfo();
  }

  private async fetchLightningLimits() {
    return await RNAPI.fetchLightningLimits();
  }

  private async prepareReceivePayment(args: JSAPI.PrepareReceiveRequest) {
    const newArgs: RNAPI.PrepareReceiveRequest = {
      amount: convertReceiveAmount(args.amount),
      paymentMethod: convertPaymentMethod(args.paymentMethod),
    };
    return await RNAPI.prepareReceivePayment(newArgs);
  }

  private async receivePayment(args: JSAPI.ReceivePaymentRequest) {
    const newArgs: RNAPI.ReceivePaymentRequest = {
      prepareResponse: convertPrepareResponse(args.prepareResponse),
      description: args.description,
      // useDescriptionHash: args.useDescriptionHash,
    };
    return await RNAPI.receivePayment(newArgs);
  }

  private async prepareSendPayment(args: JSAPI.PrepareSendRequest) {
    const newArgs: RNAPI.PrepareSendRequest = {
      ...args,
      amount: convertPayAmount(args.amount),
    };
    return await RNAPI.prepareSendPayment(newArgs);
  }

  private async sendPayment(args: JSAPI.SendPaymentRequest) {
    return await RNAPI.sendPayment(args as RNAPI.SendPaymentRequest); // type is too complex to convert
  }

  get api() {
    const getInfo = this.withLockAndSdk(this.getInfo.bind(this));
    const prepareReceivePayment = this.withLockAndSdk(this.prepareReceivePayment.bind(this));
    const fetchLightningLimits = this.withLockAndSdk(this.fetchLightningLimits.bind(this));
    const receivePayment = this.withLockAndSdk(this.receivePayment.bind(this));
    const prepareSendPayment = this.withLockAndSdk(this.prepareSendPayment.bind(this));
    const sendPayment = this.withLockAndSdk(this.sendPayment.bind(this));

    return {
      getInfo,
      prepareReceivePayment,
      fetchLightningLimits,
      receivePayment,
      prepareSendPayment,
      sendPayment,
    };
  }

  async disconnect() {
    await RNAPI.disconnect();
    this.initialized = false;
  }
}

// Map our app network to Breez LiquidNetwork type
export const getBreezNetwork = (network: typeof NETWORK_BREEZ | typeof NETWORK_BREEZTESTNET) => {
  if (network === NETWORK_BREEZ) {
    return RNAPI.LiquidNetwork.MAINNET;
  } else if (network === NETWORK_BREEZTESTNET) {
    return RNAPI.LiquidNetwork.TESTNET;
  } else {
    throw new Error(`Unsupported Breez network: ${network}`);
  }
};

global.breezAdapter = new BreezAdapter();
