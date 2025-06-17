import type {
  AssetMetadata,
  GetInfoResponse,
  LightningPaymentLimitsResponse,
  LiquidNetwork,
  PrepareReceiveRequest,
  PrepareReceiveResponse,
  PrepareSendRequest,
  PrepareSendResponse,
  ReceivePaymentRequest,
  ReceivePaymentResponse,
  SendPaymentRequest,
  SendPaymentResponse,
} from '@breeztech/breez-sdk-liquid';
import { NETWORK_LIGHTNING, NETWORK_LIGHTNINGTESTNET, NETWORK_LIQUID, NETWORK_LIQUIDTESTNET } from '../../types/networks';

export type BreezConnection = {
  mnemonic: string;
  network: LiquidNetwork;
};

export interface IBreezAdapter {
  api: {
    getInfo: (connection: BreezConnection) => Promise<GetInfoResponse>;
    fetchLightningLimits: (connection: BreezConnection) => Promise<LightningPaymentLimitsResponse>;
    prepareReceivePayment: (connection: BreezConnection, args: PrepareReceiveRequest) => Promise<PrepareReceiveResponse>;
    receivePayment: (connection: BreezConnection, args: ReceivePaymentRequest) => Promise<ReceivePaymentResponse>;
    prepareSendPayment: (connection: BreezConnection, args: PrepareSendRequest) => Promise<PrepareSendResponse>;
    sendPayment: (connection: BreezConnection, args: SendPaymentRequest) => Promise<SendPaymentResponse>;
  };
}

export class BreezWallet {
  public m: string;
  public n: LiquidNetwork;
  public adapter: IBreezAdapter;

  constructor(mnemonic: string, network: LiquidNetwork) {
    this.m = mnemonic;
    this.n = network;
    this.adapter = globalThis.breezAdapter;
  }

  private get connection() {
    return { mnemonic: this.m, network: this.n };
  }

  public async getInfo() {
    return await this.adapter.api.getInfo(this.connection);
  }

  public async getBalance() {
    const info = await this.getInfo();
    return info.walletInfo.balanceSat + info.walletInfo.pendingReceiveSat;
  }

  public async getAssetBalances() {
    const info = await this.getInfo();
    return info.walletInfo.assetBalances;
  }

  public async fetchLightningLimits() {
    return await this.adapter.api.fetchLightningLimits(this.connection);
  }

  public async prepareReceivePayment(args: PrepareReceiveRequest) {
    return await this.adapter.api.prepareReceivePayment(this.connection, args);
  }

  public async receivePayment(args: ReceivePaymentRequest) {
    return await this.adapter.api.receivePayment(this.connection, args);
  }

  public async prepareSendPayment(args: PrepareSendRequest) {
    return await this.adapter.api.prepareSendPayment(this.connection, args);
  }

  public async sendPayment(args: SendPaymentRequest) {
    return await this.adapter.api.sendPayment(this.connection, args);
  }

  public async getAddressLiquid() {
    const prepareResponse = await this.prepareReceivePayment({
      paymentMethod: 'liquidAddress',
    });
    const receiveResponse = await this.receivePayment({
      prepareResponse,
    });
    if (!receiveResponse.destination) {
      throw new Error('Failed to generate Liquid address');
    }
    return receiveResponse.destination;
  }
}

// Additional assets
export const assetMetadata: AssetMetadata[] = [
  {
    assetId: '144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49',
    name: 'Testnet Bitcoin',
    ticker: 'tBTC',
    precision: 8,
  },
  {
    assetId: 'ec24f3e4a4993802f901d881ea1bbfc642dfbc25d5fe82af256',
    name: 'KEK LOL',
    ticker: 'LOLx',
    precision: 7,
  },
  {
    assetId: 'ec24f3e4a4993802f901d881ea1bbfc642dfbc25d5fe82af2564ddc59dc025a9',
    name: 'KEK LOL2',
    ticker: 'LOLx2',
    precision: 7,
  },
  {
    assetId: '139768b54fb12cdb732d02d12aba8abb7de8f8f5ae776ca13e2ba10cbf306aa9',
    name: 'KEK LOL3',
    ticker: 'LOLx3',
    precision: 7,
  },
];

// L-BTC asset IDs for mainnet and testnet
export const LBTC_ASSET_IDS = {
  mainnet: '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d',
  testnet: '144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49',
};

// Map our app network to Breez LiquidNetwork type
export const getBreezNetwork = (network: typeof NETWORK_LIQUID | typeof NETWORK_LIQUIDTESTNET | typeof NETWORK_LIGHTNING | typeof NETWORK_LIGHTNINGTESTNET) => {
  if (network === NETWORK_LIQUID || network === NETWORK_LIGHTNING) {
    return 'mainnet';
  } else if (network === NETWORK_LIQUIDTESTNET || network === NETWORK_LIGHTNINGTESTNET) {
    return 'testnet';
  } else {
    throw new Error(`Unsupported Breez network: ${network}`);
  }
};
