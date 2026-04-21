import type { IBreezAdapter } from '@shared/class/wallets/breez-wallet';
import type { ISparkAdapter } from '@shared/class/wallets/spark-wallet';

const unsupportedError = (networkName: string) => new Error(`${networkName} is not supported in Mac Catalyst builds yet.`);

const unsupportedBreezAdapter: IBreezAdapter = {
  api: {
    getInfo: async () => {
      throw unsupportedError('Liquid');
    },
    fetchLightningLimits: async () => {
      throw unsupportedError('Liquid');
    },
    prepareReceivePayment: async () => {
      throw unsupportedError('Liquid');
    },
    receivePayment: async () => {
      throw unsupportedError('Liquid');
    },
    prepareSendPayment: async () => {
      throw unsupportedError('Liquid');
    },
    sendPayment: async () => {
      throw unsupportedError('Liquid');
    },
    getPayment: async () => {
      throw unsupportedError('Liquid');
    },
    listPayments: async () => {
      throw unsupportedError('Liquid');
    },
  },
};

const unsupportedSparkAdapter: ISparkAdapter = {
  initialize: async () => {
    throw unsupportedError('Spark');
  },
};

global.breezAdapter = unsupportedBreezAdapter;
global.sparkAdapter = unsupportedSparkAdapter;
