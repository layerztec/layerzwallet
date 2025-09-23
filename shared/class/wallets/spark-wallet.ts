import assert from 'assert';
import bolt11 from 'bolt11';
import { SparkWallet as SDK, TokenBalanceMap } from '@buildonspark/spark-sdk';
import BigNumber from 'bignumber.js';

import { ArkWallet } from './ark-wallet';
import { createLightningInvoiceResponse, InterfaceLightningWallet, LightningPaymentLimitsResponse } from './interface-lightning-wallet';
import { CommonTransaction } from '../../types/common-transaction';
import { NETWORK_BITCOIN, NETWORK_SPARK } from '../../types/networks';
import * as BlueElectrum from '../../blue_modules/BlueElectrum';
import { CommonSwap } from '../../types/common-swap';
import { AllNetworkInfos } from '../../models/all-network-infos';

// copypasted from `node_modules/@buildonspark/spark-sdk/dist/...` since its not exported
type Bech32mTokenIdentifier = `btkn1${string}` | `btknrt1${string}` | `btknt1${string}` | `btkns1${string}` | `btknl1${string}`;

export interface ISparkAdapter {
  initialize(...options: Parameters<typeof SDK.initialize>): ReturnType<typeof SDK.initialize>;
}

// not exposed in the SDK
export type StaticDepositQuoteOutput = Awaited<ReturnType<SDK['getClaimStaticDepositQuote']>>;

export class SparkWallet extends ArkWallet implements InterfaceLightningWallet {
  private _sdkWallet: Awaited<ReturnType<typeof SDK.initialize>>['wallet'] | undefined = undefined;
  protected adapter: ISparkAdapter;

  protected _bolt11toReceiveRequestId: Record<string, string> = {};
  private tokenBalances: TokenBalanceMap = new Map();

  constructor() {
    super();
    this.adapter = globalThis.sparkAdapter;
  }

  async init() {
    assert(this.secret, 'Internal error: cant init Spark wallet, secret is not set.');
    const { wallet } = await this.adapter.initialize({
      mnemonicOrSeed: this.secret,
      options: {
        network: 'MAINNET',
      },
    });

    wallet.on('transfer:claimed', (transferId: string, updatedBalance: bigint) => {
      console.log(`Transfer ${transferId} claimed. New balance: ${updatedBalance}`);
    });

    this._sdkWallet = wallet;
  }

  async getTransaction() {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    const transfers = await this._sdkWallet.getTransfers(1000, 0);
    return transfers.transfers;
  }

  async payLightningInvoice(invoice: string, masFeePercentage: number = 1) {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    const decoded = bolt11.decode(invoice);
    if (!decoded.satoshis) throw new Error('Cant pay zero-amount invoices');

    const maxFeeSats = Math.max(2, Math.ceil((decoded.satoshis / 100) * masFeePercentage));

    const payment_response = await this._sdkWallet.payLightningInvoice({
      invoice,
      maxFeeSats,
    });
    console.log('Payment Response:', payment_response);

    if (payment_response.status === 'LIGHTNING_PAYMENT_SUCCEEDED' || payment_response.status === 'LIGHTNING_PAYMENT_INITIATED') {
      return true;
    }

    return false;
  }

  async getOffchainReceiveAddress(): Promise<string> {
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
    this._lastBalanceFetch = Date.now();
    this.tokenBalances = balance.tokenBalances;
    return Number(balance.balance);
  }

  getTokenBalances(): TokenBalanceMap {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');
    return this.tokenBalances;
  }

  async createLightningInvoice(amountSats: number, memo: string = ''): Promise<createLightningInvoiceResponse> {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    const invoice = await this._sdkWallet.createLightningInvoice({
      amountSats,
      memo,
    });

    console.log('Invoice:', invoice);

    this._bolt11toReceiveRequestId[invoice.invoice.encodedInvoice] = invoice.id;

    return {
      invoice: invoice.invoice.encodedInvoice,
      serviceFeeSat: 0, // im currently not aware of any fees that Spark takes when receiving
    };
  }

  async isInvoicePaid(invoice: string): Promise<boolean> {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    const id = this._bolt11toReceiveRequestId[invoice];

    const lightningPaymentStatus = await this._sdkWallet.getLightningReceiveRequest(id);

    if (lightningPaymentStatus?.status === 'LIGHTNING_PAYMENT_RECEIVED') return true;
    if (lightningPaymentStatus?.status === 'TRANSFER_COMPLETED') return true;

    return false;
  }

  async fetchLightningLimits(): Promise<LightningPaymentLimitsResponse> {
    return Promise.resolve({
      send: {
        maxSat: -1,
        minSat: -1,
        maxZeroConfSat: -1,
      },
      receive: {
        maxZeroConfSat: 0,
        minSat: 0,
        maxSat: 100000000,
      },
    });
  }

  async getCommonTransactions(): Promise<CommonTransaction[]> {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    type WalletTransfer = Awaited<ReturnType<typeof this._sdkWallet.getTransfers>>['transfers'][number];

    // fetch all transfers in chunks of 100
    const transfers: WalletTransfer[] = [];
    let offset = 0;
    while (true) {
      const { transfers: tr } = await this._sdkWallet.getTransfers(100, offset);
      if (tr.length === 0) break;
      transfers.push(...tr);
      offset += 100;
    }

    const commonTransactions: CommonTransaction[] = [];
    for (const transfer of transfers) {
      const timestamp = Math.floor((transfer.updatedTime ?? transfer.createdTime)!.getTime() / 1000);
      const status = transfer.status === 'TRANSFER_STATUS_COMPLETED' ? 'confirmed' : 'pending';

      commonTransactions.push({
        network: NETWORK_SPARK,
        txid: transfer.id,
        amount: transfer.totalValue,
        timestamp,
        status,
        direction: transfer.transferDirection === 'OUTGOING' ? 'send' : 'receive',
      });
    }

    return commonTransactions;
  }

  async transferTokens(tokenIdentifier: string, tokenAmount: bigint, receiverSparkAddress: string): Promise<string> {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    return await this._sdkWallet.transferTokens({ receiverSparkAddress, tokenAmount, tokenIdentifier: tokenIdentifier as Bech32mTokenIdentifier });
  }

  allowLightning() {
    return true;
  }

  async getOnchainDepositAddress(): Promise<string> {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    return await this._sdkWallet.getStaticDepositAddress();
  }

  async getCommonSwaps(): Promise<CommonSwap[]> {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    const address = await this.getOnchainDepositAddress();
    if (!BlueElectrum.mainConnected) await BlueElectrum.connectMain();

    const explorerBase = AllNetworkInfos[NETWORK_BITCOIN].explorerUrl;
    const swaps: CommonSwap[] = [];

    // at first we get unclaimed swaps. This is our UTXOs
    const UTXOs = await BlueElectrum.multiGetUtxoByAddress([address]);
    const txs1 = await BlueElectrum.multiGetTransactionByTxid([...UTXOs[address].map((output) => output.txid)], true);
    const unclaimedSwaps: CommonSwap[] = UTXOs[address].map((output) => {
      const tx = txs1[output.txid];
      const timestamp = tx.blocktime ? tx.blocktime * 1000 : new Date().getTime();
      const claimable = tx.confirmations >= 3; // according to Spark docs, 3 confirmations are needed to claim a swap
      return {
        network: NETWORK_SPARK,
        id: output.txid,
        status: claimable ? 'claimable' : 'pending',
        amount: output.value,
        timestamp,
        direction: 'receive',
        explorerUrl: `${explorerBase}/tx/${output.txid}`,
        // we only want to show confirmations for 'pending' swaps
        confirmations: !claimable ? tx.confirmations : undefined,
        targetConfirmations: !claimable ? 3 : undefined,
      };
    });
    swaps.push(...unclaimedSwaps);

    // now we need to get sent transactions. This is our claimed swaps
    const txsByAddress = await BlueElectrum.getTransactionsByAddress(address);
    const txs2 = await BlueElectrum.multiGetTransactionByTxid([...txsByAddress.map((tx) => tx.tx_hash)], true);
    const filteredTxs = Object.values(txs2) // TODO: distinguish between Claim and Refund. How to do this?
      // filter out incoming transactions
      .filter((tx) => !tx.vout.some((output) => output.scriptPubKey.addresses.some((a) => a === address)))
      // only include transactions with one input and one output
      .filter((tx) => tx.vin.length === 1 && tx.vout.length === 1);
    const claimedSwaps: CommonSwap[] = filteredTxs.map((tx) => {
      const timestamp = tx.blocktime ? tx.blocktime * 1000 : new Date().getTime();
      return {
        network: NETWORK_SPARK,
        id: tx.txid,
        status: 'confirmed',
        timestamp,
        amount: BigNumber(tx.vout[0].value).multipliedBy(100000000).toNumber(),
        direction: 'receive',
        explorerUrl: `${explorerBase}/tx/${tx.txid}`,
      };
    });
    swaps.push(...claimedSwaps);

    swaps.sort((a, b) => b.timestamp! - a.timestamp!);

    return swaps;
  }

  async getDepositQuote(txid: string): Promise<StaticDepositQuoteOutput> {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    return await this._sdkWallet.getClaimStaticDepositQuote(txid);
  }

  async claimDepositSpark(quote: StaticDepositQuoteOutput): Promise<void> {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    await this._sdkWallet.claimStaticDeposit({
      transactionId: quote.transactionId,
      creditAmountSats: quote.creditAmountSats,
      sspSignature: quote.signature,
    });
  }

  async refundDeposit(txid: string, destinationAddress: string): Promise<void> {
    if (!this._sdkWallet) throw new Error('Spark wallet not initialized');

    if (!BlueElectrum.mainConnected) await BlueElectrum.connectMain();
    const fees = await BlueElectrum.estimateFees();

    const hex = await this._sdkWallet.refundStaticDeposit({
      depositTransactionId: txid,
      destinationAddress,
      satsPerVbyteFee: fees.fast,
    });

    await BlueElectrum.broadcastV2(hex);
  }
}
