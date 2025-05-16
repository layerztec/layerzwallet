import init, { BindingLiquidSdk, connect, defaultConfig, PrepareReceiveRequest, ReceivePaymentRequest, PrepareSendRequest, SendPaymentRequest } from '@breeztech/breez-sdk-liquid';
import { BreezConnection, IBreezAdapter } from '@shared/class/wallets/breez-wallet';
import { NETWORK_BREEZ, NETWORK_BREEZTESTNET } from '@shared/types/networks';

const API_KEY = process.env.EXPO_PUBLIC_BREEZ_API_KEY;

class BreezAdapter implements IBreezAdapter {
  private initialized: boolean = false;
  private cc: BreezConnection | undefined;
  private sdk?: BindingLiquidSdk;

  get activeconnection() {
    return this.cc;
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
    this.sdk = await connect({ mnemonic: connection.mnemonic, config: defaultConfig(connection.network, API_KEY) });
    this.cc = connection;
    return this.sdk;
  }

  private async getInfo(connection: BreezConnection) {
    const sdk = await this.getSdk(connection);
    return await sdk.getInfo();
  }

  private async fetchLightningLimits(connection: BreezConnection) {
    const sdk = await this.getSdk(connection);
    return await sdk.fetchLightningLimits();
  }

  private async prepareReceivePayment(connection: BreezConnection, args: PrepareReceiveRequest) {
    const sdk = await this.getSdk(connection);
    return await sdk.prepareReceivePayment(args);
  }

  private async receivePayment(connection: BreezConnection, args: ReceivePaymentRequest) {
    const sdk = await this.getSdk(connection);
    return await sdk.receivePayment(args);
  }

  private async prepareSendPayment(connection: BreezConnection, args: PrepareSendRequest) {
    const sdk = await this.getSdk(connection);
    return await sdk.prepareSendPayment(args);
  }

  private async sendPayment(connection: BreezConnection, args: SendPaymentRequest) {
    const sdk = await this.getSdk(connection);
    return await sdk.sendPayment(args);
  }

  get api() {
    return {
      getInfo: (connection: BreezConnection) => this.getInfo(connection),
      fetchLightningLimits: (connection: BreezConnection) => this.fetchLightningLimits(connection),
      prepareReceivePayment: (connection: BreezConnection, args: PrepareReceiveRequest) => this.prepareReceivePayment(connection, args),
      receivePayment: (connection: BreezConnection, args: ReceivePaymentRequest) => this.receivePayment(connection, args),
      prepareSendPayment: (connection: BreezConnection, args: PrepareSendRequest) => this.prepareSendPayment(connection, args),
      sendPayment: (connection: BreezConnection, args: SendPaymentRequest) => this.sendPayment(connection, args),
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
