import { ArkWallet } from './ark-wallet';
import { SparkWallet as SDK } from '@buildonspark/spark-sdk';
import { InterfaceLightningWallet } from './interface-lightning-wallet';

export interface ISparkAdapter {
  initialize(...options: Parameters<typeof SDK.initialize>): ReturnType<typeof SDK.initialize>;
}

export class SparkWallet extends ArkWallet implements InterfaceLightningWallet {
  private _sdkWallet: SDK | undefined = undefined;
  protected adapter: ISparkAdapter;

  protected _bolt11toReceiveRequestId: Record<string, string> = {};

  constructor() {
    super();
    this.adapter = globalThis.sparkAdapter;
  }

  async init() {
    const { wallet } = await this.adapter.initialize({
      mnemonicOrSeed: this.secret,
      options: {
        network: 'MAINNET',
      },
    });

    wallet.on('transfer:claimed', (transferId: string, balance: number) => {
      console.log(`Transfer ${transferId} claimed. New balance: ${balance}`);
    });

    this._sdkWallet = wallet;
  }

  async getTransaction() {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    const transfers = await this._sdkWallet.getTransfers(1000, 0);
    return transfers.transfers;
  }

  async payLightningInvoice(invoice: string) {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    // todo: decode invoice,  set maxFeeSats as 1% of amount

    const payment_response = await this._sdkWallet.payLightningInvoice({
      invoice,
      maxFeeSats: 99,
    });
    console.log('Payment Response:', payment_response);

    if (payment_response.status === 'LIGHTNING_PAYMENT_SUCCEEDED' || payment_response.status === 'LIGHTNING_PAYMENT_INITIATED') {
      return true;
    }

    return false;
  }

  async getOffchainReceiveAddress(): Promise<string | undefined> {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    return await this._sdkWallet.getSparkAddress();
  }

  async pay(receiverSparkAddress: string, amountSats: number): Promise<string> {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    const transfer = await this._sdkWallet.transfer({
      receiverSparkAddress,
      amountSats,
    });

    console.log('Transfer:', transfer);
    return transfer.id;
  }

  async getOffchainBalance() {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');
    const balance = await this._sdkWallet.getBalance();
    return Number(balance.balance);
  }

  async createLightningInvoice(amountSats: number, memo: string = '') {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    const invoice = await this._sdkWallet.createLightningInvoice({
      amountSats,
      memo,
    });

    console.log('Invoice:', invoice);

    this._bolt11toReceiveRequestId[invoice.invoice.encodedInvoice] = invoice.id;

    return invoice.invoice.encodedInvoice;
  }

  allowLightning(): boolean {
    return true;
  }

  async isInvoicePaid(invoice: string): Promise<boolean> {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    const id = this._bolt11toReceiveRequestId[invoice];

    const lightningPaymentStatus = await this._sdkWallet.getLightningReceiveRequest(id);

    if (lightningPaymentStatus?.status === 'LIGHTNING_PAYMENT_RECEIVED') return true;
    if (lightningPaymentStatus?.status === 'TRANSFER_COMPLETED') return true;

    return false;
  }
}
