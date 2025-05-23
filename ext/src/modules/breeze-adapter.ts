import init, { BindingLiquidSdk, connect, defaultConfig, PrepareReceiveRequest, ReceivePaymentRequest, PrepareSendRequest, SendPaymentRequest } from '@breeztech/breez-sdk-liquid';
import { BreezConnection, IBreezAdapter, assetMetadata } from '@shared/class/wallets/breez-wallet';
import { NETWORK_BREEZ, NETWORK_BREEZTESTNET } from '@shared/types/networks';

const API_KEY = process.env.EXPO_PUBLIC_BREEZ_API_KEY;

class BreezAdapter implements IBreezAdapter {
  private initialized: boolean = false;
  private cc: BreezConnection | undefined;
  private sdk?: BindingLiquidSdk;
  private sdkLock: Promise<void> = Promise.resolve();

  // This function is used to ensure that the SDK is initialized before calling the function
  // It also ensures that the SDK is not initialized multiple times at the same times
  private withLockAndSdk<T, Args extends any[]>(fn: (sdk: BindingLiquidSdk, ...args: Args) => Promise<T>): (connection: BreezConnection, ...args: Args) => Promise<T> {
    return async (connection: BreezConnection, ...args: Args): Promise<T> => {
      let releaseLock: () => void = () => {};
      const lockPromise = new Promise<void>((resolve) => (releaseLock = resolve));
      await this.sdkLock; // Wait for any ongoing SDK initialization to complete
      this.sdkLock = lockPromise; // Set new lock

      try {
        const sdk = await this.getSdk(connection);
        return await fn(sdk, ...args);
      } finally {
        releaseLock();
      }
    };
  }

  private async getSdk(connection: BreezConnection) {
    if (!this.initialized) {
      await init();
      this.initialized = true;
    }
    if (connection.mnemonic === this.cc?.mnemonic && connection.network === this.cc?.network && this.sdk) {
      return this.sdk;
    }
    await this.sdk?.disconnect();
    const config = defaultConfig(connection.network, API_KEY);
    config.assetMetadata = assetMetadata;
    this.sdk = await connect({ mnemonic: connection.mnemonic, config });
    this.cc = connection;
    return this.sdk;
  }

  private async getInfo(sdk: BindingLiquidSdk) {
    return await sdk.getInfo();
  }

  private async fetchLightningLimits(sdk: BindingLiquidSdk) {
    return await sdk.fetchLightningLimits();
  }

  private async prepareReceivePayment(sdk: BindingLiquidSdk, args: PrepareReceiveRequest) {
    return await sdk.prepareReceivePayment(args);
  }

  private async receivePayment(sdk: BindingLiquidSdk, args: ReceivePaymentRequest) {
    return await sdk.receivePayment(args);
  }

  private async prepareSendPayment(sdk: BindingLiquidSdk, args: PrepareSendRequest) {
    return await sdk.prepareSendPayment(args);
  }

  private async sendPayment(sdk: BindingLiquidSdk, args: SendPaymentRequest) {
    return await sdk.sendPayment(args);
  }

  get api() {
    const getInfo = this.withLockAndSdk(this.getInfo.bind(this));
    const fetchLightningLimits = this.withLockAndSdk(this.fetchLightningLimits.bind(this));
    const prepareReceivePayment = this.withLockAndSdk(this.prepareReceivePayment.bind(this));
    const receivePayment = this.withLockAndSdk(this.receivePayment.bind(this));
    const prepareSendPayment = this.withLockAndSdk(this.prepareSendPayment.bind(this));
    const sendPayment = this.withLockAndSdk(this.sendPayment.bind(this));

    return {
      getInfo,
      fetchLightningLimits,
      prepareReceivePayment,
      receivePayment,
      prepareSendPayment,
      sendPayment,
    };
  }

  async disconnect() {
    await this.sdk?.disconnect();
    this.sdk = undefined;
    this.initialized = false;
    this.cc = undefined;
  }
}

// Map our app network to Breez LiquidNetwork type
export const getBreezNetwork = (network: typeof NETWORK_BREEZ | typeof NETWORK_BREEZTESTNET) => {
  if (network === NETWORK_BREEZ) {
    return 'mainnet';
  } else if (network === NETWORK_BREEZTESTNET) {
    return 'testnet';
  } else {
    throw new Error(`Unsupported Breez network: ${network}`);
  }
};

globalThis.breezAdapter = new BreezAdapter();
