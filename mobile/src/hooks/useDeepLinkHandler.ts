import { useURL } from 'expo-linking';
import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import * as bip21 from 'bip21';

export function useDeepLinkHandler() {
  const url = useURL();
  const router = useRouter();

  if (url) {
    console.debug('[DEEP_LINK_DEBUG] useDeepLinkHandler received url:', url);
  }

  const handleBitcoinUrl = useCallback(
    (url: string) => {
      try {
        const decoded = bip21.decode(url);

        if (decoded.address) {
          const params: Record<string, any> = {
            toAddress: decoded.address,
          };

          if (decoded.options?.amount) {
            params.amount = decoded.options.amount.toString();
          }

          if (decoded.options?.label) {
            params.label = decoded.options.label;
          }

          if (decoded.options?.message) {
            params.message = decoded.options.message;
          }

          console.debug('[DEEPLINK] Bitcoin URL parsed, navigating to SendBtc with params:', params);
          router.replace({
            pathname: '/SendBtc' as any,
            params: params,
          });
          return;
        }

        // Handle swap interface requests: bitcoin:?showSwapInterface=true&...
        const urlObj = new URL(url);
        const searchParams = new URLSearchParams(urlObj.search);

        if (searchParams.get('showSwapInterface') === 'true') {
          const params: Record<string, any> = {
            showSwapInterface: 'true',
          };

          if (searchParams.get('fromNetwork')) {
            params.fromNetwork = searchParams.get('fromNetwork');
          }
          if (searchParams.get('toNetwork')) {
            params.toNetwork = searchParams.get('toNetwork');
          }
          if (searchParams.get('amount')) {
            params.amount = searchParams.get('amount');
          }

          console.debug('[DEEPLINK] Bitcoin swap URL parsed, navigating to home with params:', params);
          router.push({
            pathname: '/home' as any,
            params: params,
          });
          return;
        }
      } catch (error) {
        console.error('[DEEPLINK] Error parsing Bitcoin URL:', error);
        try {
          const urlObj = new URL(url);
          const address = urlObj.pathname;
          if (address && address.length > 0) {
            console.debug('[DEEPLINK] Fallback: extracted address from pathname:', address);
            router.replace({
              pathname: '/SendBtc' as any,
              params: { toAddress: address },
            });
          }
        } catch (fallbackError) {
          console.error('[DEEPLINK] Fallback parsing also failed:', fallbackError);
        }
      }
    },
    [router]
  );

  const handleLiquidUrl = useCallback(
    (url: string) => {
      try {
        const urlObj = new URL(url);
        const address = urlObj.pathname;
        const searchParams = new URLSearchParams(urlObj.search);

        if (address) {
          const params: Record<string, any> = {
            toAddress: address,
          };

          if (searchParams.get('amount')) {
            params.amount = searchParams.get('amount');
          }

          if (searchParams.get('assetId')) {
            params.assetId = searchParams.get('assetId');
          }

          console.debug('[DEEPLINK] Liquid URL parsed, navigating to SendLiquid with params:', params);
          router.push({
            pathname: '/SendLiquid' as any,
            params: params,
          });
          return;
        }

        if (searchParams.get('showSwapInterface') === 'true') {
          const params: Record<string, any> = {
            showSwapInterface: 'true',
          };

          if (searchParams.get('fromNetwork')) {
            params.fromNetwork = searchParams.get('fromNetwork');
          }
          if (searchParams.get('toNetwork')) {
            params.toNetwork = searchParams.get('toNetwork');
          }
          if (searchParams.get('amount')) {
            params.amount = searchParams.get('amount');
          }

          console.debug('[DEEPLINK] Liquid swap URL parsed, navigating to home with params:', params);
          router.push({
            pathname: '/home' as any,
            params: params,
          });
        }
      } catch (error) {
        console.error('[DEEPLINK] Error parsing Liquid URL:', error);
      }
    },
    [router]
  );

  const handleLayerzWalletUrl = useCallback(
    (url: string) => {
      try {
        const urlObj = new URL(url);
        const path = urlObj.pathname;
        const searchParams = new URLSearchParams(urlObj.search);

        console.debug('[DEEPLINK] LayerzWallet URL path:', path, 'params:', Object.fromEntries(searchParams));

        if (path.startsWith('/send/btc')) {
          const params: Record<string, any> = {};

          if (searchParams.get('toAddress')) {
            params.toAddress = searchParams.get('toAddress');
          }
          if (searchParams.get('amount')) {
            params.amount = searchParams.get('amount');
          }

          console.debug('[DEEPLINK] LayerzWallet BTC send, navigating to SendBtc with params:', params);
          router.replace({
            pathname: '/SendBtc' as any,
            params: params,
          });
          return;
        }

        if (path.startsWith('/send/liquid')) {
          const params: Record<string, any> = {};

          if (searchParams.get('toAddress')) {
            params.toAddress = searchParams.get('toAddress');
          }
          if (searchParams.get('amount')) {
            params.amount = searchParams.get('amount');
          }
          if (searchParams.get('assetId')) {
            params.assetId = searchParams.get('assetId');
          }

          console.debug('[DEEPLINK] LayerzWallet Liquid send, navigating to SendLiquid with params:', params);
          router.push({
            pathname: '/SendLiquid' as any,
            params: params,
          });
          return;
        }

        if (path.startsWith('/send/ark')) {
          const params: Record<string, any> = {};

          if (searchParams.get('toAddress')) {
            params.toAddress = searchParams.get('toAddress');
          }
          if (searchParams.get('amount')) {
            params.amount = searchParams.get('amount');
          }

          console.debug('[DEEPLINK] LayerzWallet ARK send, navigating to SendArk with params:', params);
          router.push({
            pathname: '/SendArk' as any,
            params: params,
          });
          return;
        }

        if (path.startsWith('/send/lightning')) {
          const params: Record<string, any> = {};

          if (searchParams.get('network')) {
            params.network = searchParams.get('network');
          }
          if (searchParams.get('invoice')) {
            params.invoice = searchParams.get('invoice');
          }

          console.debug('[DEEPLINK] LayerzWallet Lightning send, navigating to SendLightning with params:', params);
          router.push({
            pathname: '/SendLightning' as any,
            params: params,
          });
          return;
        }

        if (path.startsWith('/send/evm')) {
          const params: Record<string, any> = {};

          if (searchParams.get('toAddress')) {
            params.toAddress = searchParams.get('toAddress');
          }
          if (searchParams.get('amount')) {
            params.amount = searchParams.get('amount');
          }

          console.debug('[DEEPLINK] LayerzWallet EVM send, navigating to SendEvm with params:', params);
          router.push({
            pathname: '/SendEvm' as any,
            params: params,
          });
          return;
        }

        if (path.startsWith('/send/token/')) {
          const contractAddress = path.split('/send/token/')[1];
          const params: Record<string, any> = {
            contractAddress,
          };

          if (searchParams.get('toAddress')) {
            params.toAddress = searchParams.get('toAddress');
          }
          if (searchParams.get('amountToSend')) {
            params.amountToSend = searchParams.get('amountToSend');
          }

          console.debug('[DEEPLINK] LayerzWallet Token send, navigating to SendTokenEvm with params:', params);
          router.push({
            pathname: '/SendTokenEvm' as any,
            params: params,
          });
          return;
        }

        if (path.startsWith('/home') || path === '/') {
          const params: Record<string, any> = {};

          if (searchParams.get('showSwapInterface')) {
            params.showSwapInterface = searchParams.get('showSwapInterface');
          }
          if (searchParams.get('fromNetwork')) {
            params.fromNetwork = searchParams.get('fromNetwork');
          }
          if (searchParams.get('toNetwork')) {
            params.toNetwork = searchParams.get('toNetwork');
          }
          if (searchParams.get('amount')) {
            params.amount = searchParams.get('amount');
          }

          console.debug('[DEEPLINK] LayerzWallet home, navigating to home with params:', params);
          router.push({
            pathname: '/home' as any,
            params: params,
          });
        }
      } catch (error) {
        console.error('[DEEPLINK] Error parsing LayerzWallet URL:', error);
      }
    },
    [router]
  );

  const handleDeepLink = useCallback(
    (incomingUrl: string) => {
      try {
        const urlObj = new URL(incomingUrl);
        const scheme = urlObj.protocol.replace(':', '');

        switch (scheme) {
          case 'bitcoin':
            handleBitcoinUrl(incomingUrl);
            break;
          case 'liquidnetwork':
            handleLiquidUrl(incomingUrl);
            break;
          case 'layerzwallet':
            handleLayerzWalletUrl(incomingUrl);
            break;
          default:
            console.warn('[DEEPLINK] Unknown scheme:', scheme);
        }
      } catch (error) {
        console.error('[DEEPLINK] Error handling deep link:', error);
      }
    },
    [handleBitcoinUrl, handleLiquidUrl, handleLayerzWalletUrl]
  );

  useEffect(() => {
    if (url) {
      console.debug('[DEEPLINK] Received URL:', url);
      handleDeepLink(url);
    }
  }, [url, handleDeepLink]);
}
