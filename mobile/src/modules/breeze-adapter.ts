import type * as JSAPI from '@breeztech/breez-sdk-liquid';
import * as RNAPI from '@breeztech/breez-sdk-liquid-react-native';
import * as Crypto from 'expo-crypto';
import { Directory, Paths } from 'expo-file-system';

import { BreezConnection, IBreezAdapter, getAssertMetadata } from '@shared/class/wallets/breez-wallet';

const API_KEY = process.env.EXPO_PUBLIC_BREEZ_API_KEY;

const prepareReceiveResponseMap = new WeakMap<JSAPI.PrepareReceiveResponse, RNAPI.PrepareReceiveResponse>();
const prepareSendResponseMap = new WeakMap<JSAPI.PrepareSendResponse, RNAPI.PrepareSendResponse>();

const toNumber = (value: bigint | number): number => Number(value);
const toOptionalNumber = (value: bigint | number | undefined): number | undefined => (value === undefined ? undefined : Number(value));
const toBigInt = (value: bigint | number): bigint => BigInt(value);
const toOptionalBigInt = (value: bigint | number | undefined): bigint | undefined => (value === undefined ? undefined : BigInt(value));

const LIQUID_NETWORK_TO_RN: Record<JSAPI.LiquidNetwork, RNAPI.LiquidNetwork> = {
  mainnet: RNAPI.LiquidNetwork.Mainnet,
  testnet: RNAPI.LiquidNetwork.Testnet,
  regtest: RNAPI.LiquidNetwork.Regtest,
};

const PAYMENT_METHOD_TO_RN: Record<JSAPI.PaymentMethod, RNAPI.PaymentMethod> = {
  bolt11Invoice: RNAPI.PaymentMethod.Bolt11Invoice,
  bolt12Offer: RNAPI.PaymentMethod.Bolt12Offer,
  bitcoinAddress: RNAPI.PaymentMethod.BitcoinAddress,
  liquidAddress: RNAPI.PaymentMethod.LiquidAddress,
};

const PAYMENT_METHOD_TO_JS: Record<RNAPI.PaymentMethod, JSAPI.PaymentMethod> = {
  [RNAPI.PaymentMethod.Bolt11Invoice]: 'bolt11Invoice',
  [RNAPI.PaymentMethod.Bolt12Offer]: 'bolt12Offer',
  [RNAPI.PaymentMethod.BitcoinAddress]: 'bitcoinAddress',
  [RNAPI.PaymentMethod.LiquidAddress]: 'liquidAddress',
};

const PAYMENT_TYPE_TO_RN: Record<JSAPI.PaymentType, RNAPI.PaymentType> = {
  receive: RNAPI.PaymentType.Receive,
  send: RNAPI.PaymentType.Send,
};

const PAYMENT_TYPE_TO_JS: Record<RNAPI.PaymentType, JSAPI.PaymentType> = {
  [RNAPI.PaymentType.Receive]: 'receive',
  [RNAPI.PaymentType.Send]: 'send',
};

const PAYMENT_STATE_TO_RN: Record<JSAPI.PaymentState, RNAPI.PaymentState> = {
  created: RNAPI.PaymentState.Created,
  pending: RNAPI.PaymentState.Pending,
  complete: RNAPI.PaymentState.Complete,
  failed: RNAPI.PaymentState.Failed,
  timedOut: RNAPI.PaymentState.TimedOut,
  refundable: RNAPI.PaymentState.Refundable,
  refundPending: RNAPI.PaymentState.RefundPending,
  waitingFeeAcceptance: RNAPI.PaymentState.WaitingFeeAcceptance,
};

const PAYMENT_STATE_TO_JS: Record<RNAPI.PaymentState, JSAPI.PaymentState> = {
  [RNAPI.PaymentState.Created]: 'created',
  [RNAPI.PaymentState.Pending]: 'pending',
  [RNAPI.PaymentState.Complete]: 'complete',
  [RNAPI.PaymentState.Failed]: 'failed',
  [RNAPI.PaymentState.TimedOut]: 'timedOut',
  [RNAPI.PaymentState.Refundable]: 'refundable',
  [RNAPI.PaymentState.RefundPending]: 'refundPending',
  [RNAPI.PaymentState.WaitingFeeAcceptance]: 'waitingFeeAcceptance',
};

const NETWORK_TO_JS: Record<RNAPI.Network, JSAPI.Network> = {
  [RNAPI.Network.Bitcoin]: 'bitcoin',
  [RNAPI.Network.Testnet]: 'testnet',
  [RNAPI.Network.Signet]: 'signet',
  [RNAPI.Network.Regtest]: 'regtest',
};

const convertAssetMetadataToRn = (metadata: JSAPI.AssetMetadata): RNAPI.AssetMetadata => ({
  assetId: metadata.assetId,
  name: metadata.name,
  ticker: metadata.ticker,
  precision: metadata.precision,
  fiatId: metadata.fiatId,
});

const convertAssetBalanceToJs = (asset: RNAPI.AssetBalance): JSAPI.AssetBalance => ({
  assetId: asset.assetId,
  balanceSat: toNumber(asset.balanceSat),
  name: asset.name,
  ticker: asset.ticker,
  balance: asset.balance,
});

const convertLimitsToJs = (limits: RNAPI.Limits): JSAPI.Limits => ({
  minSat: toNumber(limits.minSat),
  maxSat: toNumber(limits.maxSat),
  maxZeroConfSat: toNumber(limits.maxZeroConfSat),
});

const convertReceiveAmountToRn = (amount?: JSAPI.ReceiveAmount): RNAPI.ReceiveAmount | undefined => {
  if (!amount) {
    return undefined;
  }

  switch (amount.type) {
    case 'bitcoin':
      return new RNAPI.ReceiveAmount.Bitcoin({ payerAmountSat: toBigInt(amount.payerAmountSat) });
    case 'asset':
      return new RNAPI.ReceiveAmount.Asset({ assetId: amount.assetId, payerAmount: amount.payerAmount });
  }
};

const convertReceiveAmountToJs = (amount?: RNAPI.ReceiveAmount): JSAPI.ReceiveAmount | undefined => {
  if (!amount) {
    return undefined;
  }

  switch (amount.tag) {
    case RNAPI.ReceiveAmount_Tags.Bitcoin:
      return { type: 'bitcoin', payerAmountSat: toNumber(amount.inner.payerAmountSat) };
    case RNAPI.ReceiveAmount_Tags.Asset:
      return { type: 'asset', assetId: amount.inner.assetId, payerAmount: amount.inner.payerAmount };
  }
};

const convertPayAmountToRn = (amount?: JSAPI.PayAmount): RNAPI.PayAmount | undefined => {
  if (!amount) {
    return undefined;
  }

  switch (amount.type) {
    case 'bitcoin':
      return new RNAPI.PayAmount.Bitcoin({ receiverAmountSat: toBigInt(amount.receiverAmountSat) });
    case 'asset':
      return new RNAPI.PayAmount.Asset({
        toAsset: amount.toAsset,
        receiverAmount: amount.receiverAmount,
        estimateAssetFees: amount.estimateAssetFees,
        fromAsset: amount.fromAsset,
      });
    case 'drain':
      return new RNAPI.PayAmount.Drain();
  }
};

const convertPayAmountToJs = (amount?: RNAPI.PayAmount): JSAPI.PayAmount | undefined => {
  if (!amount) {
    return undefined;
  }

  switch (amount.tag) {
    case RNAPI.PayAmount_Tags.Bitcoin:
      return { type: 'bitcoin', receiverAmountSat: toNumber(amount.inner.receiverAmountSat) };
    case RNAPI.PayAmount_Tags.Asset:
      return {
        type: 'asset',
        toAsset: amount.inner.toAsset,
        receiverAmount: amount.inner.receiverAmount,
        estimateAssetFees: amount.inner.estimateAssetFees,
        fromAsset: amount.inner.fromAsset,
      };
    case RNAPI.PayAmount_Tags.Drain:
      return { type: 'drain' };
  }
};

const convertDescriptionHashToRn = (descriptionHash?: JSAPI.DescriptionHash): RNAPI.DescriptionHash | undefined => {
  if (!descriptionHash) {
    return undefined;
  }

  switch (descriptionHash.type) {
    case 'useDescription':
      return new RNAPI.DescriptionHash.UseDescription();
    case 'custom':
      return new RNAPI.DescriptionHash.Custom({ hash: descriptionHash.hash });
  }
};

const convertGetPaymentRequestToRn = (request: JSAPI.GetPaymentRequest): RNAPI.GetPaymentRequest => {
  switch (request.type) {
    case 'paymentHash':
      return new RNAPI.GetPaymentRequest.PaymentHash({ paymentHash: request.paymentHash });
    case 'swapId':
      return new RNAPI.GetPaymentRequest.SwapId({ swapId: request.swapId });
  }
};

const convertListPaymentDetailsToRn = (details?: JSAPI.ListPaymentDetails): RNAPI.ListPaymentDetails | undefined => {
  if (!details) {
    return undefined;
  }

  switch (details.type) {
    case 'liquid':
      return new RNAPI.ListPaymentDetails.Liquid({ assetId: details.assetId, destination: details.destination });
    case 'bitcoin':
      return new RNAPI.ListPaymentDetails.Bitcoin({ address: details.address });
  }
};

const convertLiquidAddressDataToJs = (data: RNAPI.LiquidAddressData): JSAPI.LiquidAddressData => ({
  address: data.address,
  network: NETWORK_TO_JS[data.network],
  assetId: data.assetId,
  amount: data.amount,
  amountSat: toOptionalNumber(data.amountSat),
  label: data.label,
  message: data.message,
});

const convertSendDestinationToJs = (destination: RNAPI.SendDestination): JSAPI.SendDestination => {
  switch (destination.tag) {
    case RNAPI.SendDestination_Tags.LiquidAddress:
      return {
        type: 'liquidAddress',
        addressData: convertLiquidAddressDataToJs(destination.inner.addressData),
        bip353Address: destination.inner.bip353Address,
      };
    case RNAPI.SendDestination_Tags.Bolt11:
      return {
        type: 'bolt11',
        // We only branch on `type` for lightning destinations today.
        invoice: { bolt11: destination.inner.invoice.bolt11 } as JSAPI.LNInvoice,
        bip353Address: destination.inner.bip353Address,
      };
    case RNAPI.SendDestination_Tags.Bolt12:
      return {
        type: 'bolt12',
        // Keep the offer intentionally minimal until a caller needs more.
        offer: { offer: destination.inner.offer.offer, chains: destination.inner.offer.chains, paths: [] } as JSAPI.LNOffer,
        receiverAmountSat: toNumber(destination.inner.receiverAmountSat),
        bip353Address: destination.inner.bip353Address,
      };
  }
};

const convertPaymentDetailsToJs = (details: RNAPI.PaymentDetails): JSAPI.PaymentDetails => {
  switch (details.tag) {
    case RNAPI.PaymentDetails_Tags.Lightning:
      return {
        type: 'lightning',
        swapId: details.inner.swapId,
      } as JSAPI.PaymentDetails;
    case RNAPI.PaymentDetails_Tags.Liquid:
      return {
        type: 'liquid',
        assetId: details.inner.assetId,
        destination: details.inner.destination,
        description: details.inner.description,
        assetInfo: details.inner.assetInfo
          ? {
              name: details.inner.assetInfo.name,
              ticker: details.inner.assetInfo.ticker,
              amount: details.inner.assetInfo.amount,
              fees: details.inner.assetInfo.fees,
            }
          : undefined,
      } as JSAPI.PaymentDetails;
    case RNAPI.PaymentDetails_Tags.Bitcoin:
      return {
        type: 'bitcoin',
      } as JSAPI.PaymentDetails;
  }
};

const convertPaymentToJs = (payment: RNAPI.Payment): JSAPI.Payment => ({
  timestamp: payment.timestamp,
  amountSat: toNumber(payment.amountSat),
  feesSat: toNumber(payment.feesSat),
  paymentType: PAYMENT_TYPE_TO_JS[payment.paymentType],
  status: PAYMENT_STATE_TO_JS[payment.status],
  details: convertPaymentDetailsToJs(payment.details),
  swapperFeesSat: toOptionalNumber(payment.swapperFeesSat),
  destination: payment.destination,
  txId: payment.txId,
  unblindingData: payment.unblindingData,
});

const convertPrepareReceiveRequestToRn = (request: JSAPI.PrepareReceiveRequest): RNAPI.PrepareReceiveRequest => ({
  paymentMethod: PAYMENT_METHOD_TO_RN[request.paymentMethod],
  amount: convertReceiveAmountToRn(request.amount),
});

const convertPrepareReceiveResponseToJs = (response: RNAPI.PrepareReceiveResponse): JSAPI.PrepareReceiveResponse => ({
  paymentMethod: PAYMENT_METHOD_TO_JS[response.paymentMethod],
  feesSat: toNumber(response.feesSat),
  // The shared Breez wallet only reads `feesSat` and reuses this object as a cache key.
  amount: convertReceiveAmountToJs(response.amount),
});

const convertReceivePaymentRequestToRn = (request: JSAPI.ReceivePaymentRequest): RNAPI.ReceivePaymentRequest => {
  const prepareResponse = prepareReceiveResponseMap.get(request.prepareResponse);
  if (!prepareResponse) {
    throw new Error('Missing cached Breez prepareReceivePayment response');
  }

  return {
    prepareResponse,
    description: request.description,
    descriptionHash: convertDescriptionHashToRn(request.descriptionHash),
    payerNote: request.payerNote,
  };
};

const convertPrepareSendRequestToRn = (request: JSAPI.PrepareSendRequest): RNAPI.PrepareSendRequest => ({
  destination: request.destination,
  amount: convertPayAmountToRn(request.amount),
  disableMrh: request.disableMrh,
  paymentTimeoutSec: toOptionalBigInt(request.paymentTimeoutSec),
});

const convertPrepareSendResponseToJs = (response: RNAPI.PrepareSendResponse): JSAPI.PrepareSendResponse => ({
  destination: convertSendDestinationToJs(response.destination),
  feesSat: toOptionalNumber(response.feesSat),
  // The app currently only reads `destination` and `feesSat`; the original RN response is cached for sendPayment.
});

const convertSendPaymentRequestToRn = (request: JSAPI.SendPaymentRequest): RNAPI.SendPaymentRequest => {
  const prepareResponse = prepareSendResponseMap.get(request.prepareResponse);
  if (!prepareResponse) {
    throw new Error('Missing cached Breez prepareSendPayment response');
  }

  return {
    prepareResponse,
    useAssetFees: request.useAssetFees,
    payerNote: request.payerNote,
  };
};

const convertListPaymentsRequestToRn = (request: JSAPI.ListPaymentsRequest): RNAPI.ListPaymentsRequest => ({
  filters: request.filters?.map((type) => PAYMENT_TYPE_TO_RN[type]),
  states: request.states?.map((state) => PAYMENT_STATE_TO_RN[state]),
  fromTimestamp: toOptionalBigInt(request.fromTimestamp),
  toTimestamp: toOptionalBigInt(request.toTimestamp),
  offset: request.offset,
  limit: request.limit,
  details: convertListPaymentDetailsToRn(request.details),
  sortAscending: request.sortAscending,
});

const sha256 = async (mnemonic: string): Promise<string> => {
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, mnemonic);
};

const toFileSystemPath = (uri: string): string => uri.replace(/^file:\/\//, '');

const getWorkingDir = async (mnemonic: string): Promise<string> => {
  const walletDir = new Directory(Paths.document, 'breez-liquid', await sha256(mnemonic));
  walletDir.create({ idempotent: true, intermediates: true });
  return toFileSystemPath(walletDir.uri);
};

class BreezAdapter implements IBreezAdapter {
  private cc: BreezConnection | undefined;
  private sdk?: RNAPI.BindingLiquidSdkInterface;
  private sdkLock: Promise<void> = Promise.resolve();

  // This function is used to ensure that the SDK is initialized before calling the function
  // It also ensures that the SDK is not initialized multiple times at the same time
  private withLockAndSdk<T, Args extends any[]>(fn: (sdk: RNAPI.BindingLiquidSdkInterface, ...args: Args) => Promise<T>): (connection: BreezConnection, ...args: Args) => Promise<T> {
    return async (connection: BreezConnection, ...args: Args): Promise<T> => {
      let releaseLock: () => void = () => {};
      const lockPromise = new Promise<void>((resolve) => (releaseLock = resolve));
      await this.sdkLock;
      this.sdkLock = lockPromise;

      try {
        const sdk = await this.getSdk(connection);
        return await fn(sdk, ...args);
      } finally {
        releaseLock();
      }
    };
  }

  private async getSdk(connection: BreezConnection): Promise<RNAPI.BindingLiquidSdkInterface> {
    if (connection.mnemonic === this.cc?.mnemonic && connection.network === this.cc?.network && this.sdk) {
      return this.sdk;
    }

    this.sdk?.disconnect();
    this.sdk = undefined;

    const config = RNAPI.defaultConfig(LIQUID_NETWORK_TO_RN[connection.network], API_KEY);
    config.workingDir = await getWorkingDir(connection.mnemonic);
    config.assetMetadata = getAssertMetadata(connection.network).map(convertAssetMetadataToRn);
    this.sdk = RNAPI.connect({
      mnemonic: connection.mnemonic,
      passphrase: undefined,
      seed: undefined,
      config,
    });
    this.cc = connection;
    return this.sdk;
  }

  private async getInfo(sdk: RNAPI.BindingLiquidSdkInterface): Promise<JSAPI.GetInfoResponse> {
    const response = sdk.getInfo();
    return {
      walletInfo: {
        balanceSat: toNumber(response.walletInfo.balanceSat),
        pendingSendSat: toNumber(response.walletInfo.pendingSendSat),
        pendingReceiveSat: toNumber(response.walletInfo.pendingReceiveSat),
        fingerprint: response.walletInfo.fingerprint,
        pubkey: response.walletInfo.pubkey,
        assetBalances: response.walletInfo.assetBalances.map(convertAssetBalanceToJs),
      },
      blockchainInfo: {
        liquidTip: response.blockchainInfo.liquidTip,
        bitcoinTip: response.blockchainInfo.bitcoinTip,
      },
    };
  }

  private async fetchLightningLimits(sdk: RNAPI.BindingLiquidSdkInterface): Promise<JSAPI.LightningPaymentLimitsResponse> {
    const response = sdk.fetchLightningLimits();
    return {
      send: convertLimitsToJs(response.send),
      receive: convertLimitsToJs(response.receive),
    };
  }

  private async prepareReceivePayment(sdk: RNAPI.BindingLiquidSdkInterface, args: JSAPI.PrepareReceiveRequest): Promise<JSAPI.PrepareReceiveResponse> {
    const response = sdk.prepareReceivePayment(convertPrepareReceiveRequestToRn(args));
    const converted = convertPrepareReceiveResponseToJs(response);
    prepareReceiveResponseMap.set(converted, response);
    return converted;
  }

  private async receivePayment(sdk: RNAPI.BindingLiquidSdkInterface, args: JSAPI.ReceivePaymentRequest): Promise<JSAPI.ReceivePaymentResponse> {
    const response = sdk.receivePayment(convertReceivePaymentRequestToRn(args));
    return {
      destination: response.destination,
      liquidExpirationBlockheight: response.liquidExpirationBlockheight,
      bitcoinExpirationBlockheight: response.bitcoinExpirationBlockheight,
    };
  }

  private async prepareSendPayment(sdk: RNAPI.BindingLiquidSdkInterface, args: JSAPI.PrepareSendRequest): Promise<JSAPI.PrepareSendResponse> {
    const response = sdk.prepareSendPayment(convertPrepareSendRequestToRn(args));
    const converted = convertPrepareSendResponseToJs(response);
    prepareSendResponseMap.set(converted, response);
    return converted;
  }

  private async sendPayment(sdk: RNAPI.BindingLiquidSdkInterface, args: JSAPI.SendPaymentRequest): Promise<JSAPI.SendPaymentResponse> {
    return { payment: convertPaymentToJs(sdk.sendPayment(convertSendPaymentRequestToRn(args)).payment) };
  }

  private async getPayment(sdk: RNAPI.BindingLiquidSdkInterface, args: JSAPI.GetPaymentRequest): Promise<JSAPI.Payment | undefined> {
    const response = sdk.getPayment(convertGetPaymentRequestToRn(args));
    return response ? convertPaymentToJs(response) : undefined;
  }

  private async listPayments(sdk: RNAPI.BindingLiquidSdkInterface, args: JSAPI.ListPaymentsRequest): Promise<JSAPI.Payment[]> {
    return sdk.listPayments(convertListPaymentsRequestToRn(args)).map(convertPaymentToJs);
  }

  get api() {
    const getInfo = this.withLockAndSdk(this.getInfo.bind(this));
    const fetchLightningLimits = this.withLockAndSdk(this.fetchLightningLimits.bind(this));
    const prepareReceivePayment = this.withLockAndSdk(this.prepareReceivePayment.bind(this));
    const receivePayment = this.withLockAndSdk(this.receivePayment.bind(this));
    const prepareSendPayment = this.withLockAndSdk(this.prepareSendPayment.bind(this));
    const sendPayment = this.withLockAndSdk(this.sendPayment.bind(this));
    const getPayment = this.withLockAndSdk(this.getPayment.bind(this));
    const listPayments = this.withLockAndSdk(this.listPayments.bind(this));

    return {
      getInfo,
      fetchLightningLimits,
      prepareReceivePayment,
      receivePayment,
      prepareSendPayment,
      sendPayment,
      getPayment,
      listPayments,
    };
  }

  async disconnect() {
    this.sdk?.disconnect();
    this.sdk = undefined;
    this.cc = undefined;
  }
}

globalThis.breezAdapter = new BreezAdapter();
