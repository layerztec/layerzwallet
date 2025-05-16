import type {
  GetInfoResponse,
  LightningPaymentLimitsResponse,
  LiquidNetwork,
  PrepareReceiveRequest,
  PrepareReceiveResponse,
  ReceivePaymentRequest,
  ReceivePaymentResponse,
  PrepareSendRequest,
  PrepareSendResponse,
  SendPaymentRequest,
  SendPaymentResponse,
} from '@breeztech/breez-sdk-liquid';

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
}
