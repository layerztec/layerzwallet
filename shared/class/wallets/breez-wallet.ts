import type {
  AssetMetadata,
  GetInfoResponse,
  GetPaymentRequest,
  LightningPaymentLimitsResponse,
  LiquidNetwork,
  ListPaymentsRequest,
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
import * as bip21 from 'bip21';

import { createLightningInvoiceResponse, InterfaceLightningWallet } from './interface-lightning-wallet';
import { CommonTokenTransfer, CommonTransaction } from '@shared/types/common-transaction';
import { getTokenList } from '@shared/models/token-list';
import { NETWORK_LIQUID, NETWORK_LIQUID_TESTNET } from '@shared/types/networks';

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
    listPayments(connection: BreezConnection, args: ListPaymentsRequest): Promise<Payment[]>;
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

  public async listPayments(args: ListPaymentsRequest) {
    return await this.adapter.api.listPayments(this.connection, args);
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

  async payLightningInvoice(invoice: string, maxFeePercentage: number = 1): Promise<boolean> {
    const decoded = bolt11.decode(invoice);
    if (!decoded.satoshis) throw new Error('Cant pay zero-amount invoices');

    // step1: prepare the payment
    const prepareSendRequest: PrepareSendRequest = {
      destination: invoice.trim(),
    };

    const prepareResponse = await this.prepareSendPayment(prepareSendRequest);

    if (prepareResponse?.feesSat && prepareResponse.feesSat > (decoded.satoshis / 100) * maxFeePercentage) {
      throw new Error(`Potential fees to pay this invoice are more than ${maxFeePercentage}% (${prepareResponse?.feesSat} sat)`);
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
      case 'pending':
        // theoretically not safe to display this invoice as paid, but we do it for speed (breez sdk __already includes__ amount from this invoice
        // in main balance after it changes status to `pending`)
        return true;
      case 'complete':
        return true;
    }

    return false;
  }

  async getCommonTransactions(): Promise<CommonTransaction[]> {
    const payments = await this.listPayments({});

    // convert to common transaction
    const commonTransactions: CommonTransaction[] = [];
    for (const p of payments) {
      let tokenTransfers: CommonTokenTransfer[] = [];
      // Make sure it is a token transfer
      if (p.details.type === 'liquid' && !Object.values(LBTC_ASSET_IDS).includes(p.details.assetId)) {
        const tokenId = p.details.assetId;
        let amount: number | undefined;
        let address: string | undefined;
        if (p.details.assetInfo?.amount) {
          amount = p.details.assetInfo.amount;
        }
        if (p.details.destination) {
          const urnScheme = this.n === 'mainnet' ? 'liquidnetwork' : 'liquidtestnet';

          // in some cases, the destination is not a valid BIP21 address,
          // but a Lightning invoice or Liquid address
          let decoded;
          try {
            decoded = bip21.decode(p.details.destination, urnScheme);
          } catch (e) {}

          if (decoded?.address) {
            address = decoded.address;
          }
          if (amount === undefined && decoded?.options.amount) {
            amount = Number(decoded.options.amount);
          }
        }

        tokenTransfers = [{ address, amount, tokenId }];
      }

      const explorerBase = this.n === 'mainnet' ? 'https://liquid.network' : 'https://liquid.network/testnet';
      commonTransactions.push({
        txid: p.txId!,
        network: NETWORK_LIQUID,
        timestamp: p.timestamp,
        direction: p.paymentType,
        amount: p.amountSat,
        status: p.status === 'complete' ? 'confirmed' : 'pending',
        fee: p.feesSat,
        tokenTransfers,
        explorerUrl: `${explorerBase}/tx/${p.txId}`,
      });
    }

    return commonTransactions;
  }

  allowLightning() {
    return true;
  }
}

export const getAssertMetadata = (liquidNetwork: LiquidNetwork): AssetMetadata[] => {
  const network = liquidNetwork === 'mainnet' ? NETWORK_LIQUID : NETWORK_LIQUID_TESTNET;
  // we need to filter out BTC and USDT assets, otherwise we will get an error
  const filterOut = [LBTC_ASSET_IDS.mainnet, LBTC_ASSET_IDS.testnet, 'ce091c998b83c78bb71a632313ba3760f1763d9cfcffae02258ffa9865a37bd2'];
  const list = getTokenList(network).filter((token) => !filterOut.includes(token.id));
  return list.map((token) => ({
    assetId: token.id,
    name: token.name,
    ticker: token.symbol,
    precision: token.decimals,
  }));
};

// L-BTC asset IDs for mainnet and testnet
export const LBTC_ASSET_IDS = {
  mainnet: '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d',
  testnet: '144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49',
};

// Map our app network to Breez LiquidNetwork type
export const getBreezNetwork = (network: typeof NETWORK_LIQUID | typeof NETWORK_LIQUID_TESTNET) => {
  if (network === NETWORK_LIQUID) {
    return 'mainnet';
  } else if (network === NETWORK_LIQUID_TESTNET) {
    return 'testnet';
  } else {
    throw new Error(`Unsupported Breez network: ${network}`);
  }
};
