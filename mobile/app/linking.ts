import * as Linking from 'expo-linking';
import * as bip21 from 'bip21';

export default {
  prefixes: [Linking.createURL('/'), 'layerzwallet://', 'bitcoin:', 'liquidnetwork:', 'liquidwallet:', 'layerzwallet:'],
  config: {
    screens: {
      index: '',
      home: 'home',
      SendBtc: {
        path: 'SendBtc',
        parse: {
          toAddress: (toAddress: string) => toAddress,
          amount: (amount: string) => amount,
          label: (label: string) => label,
          message: (message: string) => message,
        },
      },
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
          path: [
            'liquidnetwork/:address',
            'liquidnetwork::address',
            'liquidnetwork::address?amount',
            'liquidnetwork::address?amount&assetId',
            'liquidnetwork::address?amount&assetId&message',
            'liquidnetwork::address?amount&message',
            'liquidnetwork::address?assetId',
            'liquidnetwork::address?message',
            'liquidnetwork:',
            'liquidwallet::address',
            'liquidwallet::address?amount',
            'liquidwallet::address?amount&assetId',
            'liquidwallet::address?amount&assetId&message',
            'liquidwallet::address?amount&message',
            'liquidwallet::address?assetId',
            'liquidwallet::address?message',
            'liquidwallet:',
          ],
          parse: (url: string) => {
            // Handle liquidnetwork: and liquidwallet: URIs with similar parsing logic
            if (url.startsWith('liquidnetwork:') || url.startsWith('liquidwallet:')) {
              try {
                const scheme = url.startsWith('liquidnetwork:') ? 'liquidnetwork:' : 'liquidwallet:';
                // Remove the scheme and parse
                let urlToParse = url.replace(new RegExp(`^${scheme}`), '');

                // If it starts with //, it's a full URL format
                if (urlToParse.startsWith('//')) {
                  urlToParse = scheme + urlToParse;
                } else {
                  // Simple address or address with query params
                  urlToParse = scheme + '//' + urlToParse;
                }

                const urlObj = new URL(urlToParse);
                const address = urlObj.pathname.replace(/^\//, ''); // Remove leading slash
                const params: Record<string, any> = {};

                if (address) params.toAddress = address;
                if (urlObj.searchParams.get('amount')) params.amount = urlObj.searchParams.get('amount');
                if (urlObj.searchParams.get('assetId')) params.assetId = urlObj.searchParams.get('assetId');
                if (urlObj.searchParams.get('message')) params.message = urlObj.searchParams.get('message');

                console.log(`[LINKING] Parsed ${scheme} URI:`, { url, params });
                return params;
              } catch (e) {
                console.warn(`[LINKING] ${url.startsWith('liquidnetwork:') ? 'Liquidnetwork' : 'Liquidwallet'} URI parsing failed:`, e);
                // Fallback: try to extract address directly
                const match = url.match(/^(?:liquidnetwork|liquidwallet):([a-zA-Z0-9]+)$/);
                if (match) return { toAddress: match[1] };
              }
            }

            // Legacy path handling for liquidnetwork/:address format
            const params: Record<string, any> = {};
            const urlObj = new URL(url, 'http://_');
            const pathParts = urlObj.pathname.split('/');
            const address = pathParts[pathParts.length - 1];

            if (address) params.toAddress = address;
            if (urlObj.searchParams.get('amount')) params.amount = urlObj.searchParams.get('amount');
            if (urlObj.searchParams.get('assetId')) params.assetId = urlObj.searchParams.get('assetId');
            if (urlObj.searchParams.get('message')) params.message = urlObj.searchParams.get('message');

            return params;
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
