import * as Linking from 'expo-linking';

export default {
  prefixes: [Linking.createURL('/'), 'layerzwallet://', 'bitcoin://', 'liquidnetwork://', 'layerzwallet:'],
  config: {
    screens: {
      index: '',
      home: 'home',
      SendBtc: [
        {
          path: 'send/btc',
          parse: {
            toAddress: (toAddress: string) => toAddress,
            amount: (amount: string) => amount,
          },
        },
        {
          path: 'bitcoin/:address',
          parse: {
            toAddress: (address: string) => address,
            amount: (amount: string) => amount,
          },
        },
      ],
      SendArk: {
        path: 'send/ark',
        parse: {
          toAddress: (toAddress: string) => toAddress,
          amount: (amount: string) => amount,
        },
      },
      SendLiquid: [
        {
          path: 'send/liquid',
          parse: {
            assetId: (assetId: string) => assetId,
            toAddress: (toAddress: string) => toAddress,
            amount: (amount: string) => amount,
          },
        },
        {
          path: 'liquidnetwork/:address',
          parse: {
            toAddress: (address: string) => address,
            amount: (amount: string) => amount,
            assetId: (assetId: string) => assetId,
          },
        },
      ],
      SendLightning: {
        path: 'send/lightning',
        parse: {
          network: (network: string) => network,
          invoice: (invoice: string) => invoice,
        },
      },
      SendEvm: {
        path: 'send/evm',
        parse: {
          toAddress: (toAddress: string) => toAddress,
          amount: (amount: string) => amount,
        },
      },
      SendTokenEvm: {
        path: 'send/token/:contractAddress',
        parse: {
          contractAddress: (contractAddress: string) => contractAddress,
          toAddress: (toAddress: string) => toAddress,
          amountToSend: (amountToSend: string) => amountToSend,
        },
      },
      TransactionSuccessEvm: 'transaction-success',
      notFound: '*',
    },
  },
};
