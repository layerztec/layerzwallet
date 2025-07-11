import type {
  AssetMetadata,
  GetInfoResponse,
  GetPaymentRequest,
  LightningPaymentLimitsResponse,
  LiquidNetwork,
  Payment,
  PrepareReceiveRequest,
  PrepareReceiveResponse,
  PrepareSendRequest,
  PrepareSendResponse,
  ReceivePaymentRequest,
  ReceivePaymentResponse,
  SendPaymentRequest,
  SendPaymentResponse,
} from '@breeztech/breez-sdk-liquid';
import bolt11 from 'bolt11';
import { NETWORK_LIGHTNING, NETWORK_LIGHTNINGTESTNET, NETWORK_LIQUID, NETWORK_LIQUIDTESTNET } from '../../types/networks';
import { createLightningInvoiceResponse, InterfaceLightningWallet } from './interface-lightning-wallet';

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
    getPayment(connection: BreezConnection, args: GetPaymentRequest): Promise<Payment | undefined>;
  };
}

export class BreezWallet implements InterfaceLightningWallet {
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

  allowLightning(): boolean {
    return true;
  }

  async payLightningInvoice(invoice: string, masFeePercentage: number = 1): Promise<boolean> {
    const decoded = bolt11.decode(invoice);
    if (!decoded.satoshis) throw new Error('Cant pay zero-amount invoices');

    // step1: prepare the payment
    const prepareSendRequest: PrepareSendRequest = {
      destination: invoice.trim(),
    };

    const prepareResponse = await this.prepareSendPayment(prepareSendRequest);

    if (prepareResponse?.feesSat && prepareResponse.feesSat > (decoded.satoshis / 100) * masFeePercentage) {
      throw new Error(`Potential fees to pay this invoice are more than ${masFeePercentage}%`);
    }

    const sendRequest: SendPaymentRequest = {
      prepareResponse: prepareResponse,
    };

    // Send payment
    const paymentResponse = await this.sendPayment(sendRequest);

    switch (paymentResponse.payment.status) {
      case 'failed':
        return false;

      // case  switch "created" | "pending" | "complete" | "failed" | "timedOut" | "refundable" | "refundPending" | "waitingFeeAcceptance"

      default:
        return true;
    }

    // todo: probably need to handle other statuses, and make this method return non-binary status success/failure, but smth more detailed
  }

  async createLightningInvoice(amountSats: number, memo: string): Promise<createLightningInvoiceResponse> {
    // Step 1: Prepare receive payment to get fee information
    const prepareRequest: PrepareReceiveRequest = {
      paymentMethod: 'lightning',
      amount: { type: 'bitcoin', payerAmountSat: amountSats },
    };

    const prepareResponse = await this.prepareReceivePayment(prepareRequest);

    // Step 2: Generate the actual lightning invoice
    const receiveRequest: ReceivePaymentRequest = {
      prepareResponse: prepareResponse,
      description: memo,
    };

    const receiveResponse = await this.receivePayment(receiveRequest);

    return {
      invoice: receiveResponse.destination,
      serviceFeeSat: prepareResponse.feesSat,
    };
  }

  async isInvoicePaid(invoice: string): Promise<boolean> {
    const decoded = bolt11.decode(invoice);

    let paymentHash = '';

    for (const tag of decoded.tags) {
      if (tag.tagName === 'payment_hash') {
        paymentHash = String(tag.data);
      }
    }

    if (!paymentHash) {
      throw new Error('Payment hash not found in invoice');
    }

    const paymentByHash = await this.adapter.api.getPayment(this.connection, {
      type: 'paymentHash', // unreliable, could not find type for it, had to find it in breez sources and hardcode it
      paymentHash,
    });

    switch (
      paymentByHash?.status // "created" | "pending" | "complete" | "failed" | "timedOut" | "refundable" | "refundPending" | "waitingFeeAcceptance"
    ) {
      case 'complete':
        return true;
    }

    return false;
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
