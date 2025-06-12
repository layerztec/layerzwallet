import { ArkWallet } from '@shared/class/wallets/ark-wallet';
import { SparkWallet as SDK } from '@buildonspark/spark-sdk';

export interface ISparkAdapter {
  initialize(...options: Parameters<typeof SDK.initialize>): ReturnType<typeof SDK.initialize>;
}

export class SparkWallet extends ArkWallet {
  private _sdkWallet: SDK | undefined = undefined;
  public adapter: ISparkAdapter;

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
    return payment_response;
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

  async checkLnInvoiceById(id: string) {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    return await this._sdkWallet.getLightningReceiveRequest(id);
  }

  async createLightningInvoice(amountSats: number, memo: string = '') {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    const invoice = await this._sdkWallet.createLightningInvoice({
      amountSats,
      memo,
    });

    console.log('Invoice:', invoice);

    return invoice;
  }
}
