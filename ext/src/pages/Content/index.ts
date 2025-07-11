/**
 * @fileoverview This is the INNER content script that gets injected into webpages by the loader script. For security reasons,
 * this script can only communicate with the OUTER content script through message passing.
 */
import { Provider } from '@shared/class/provider';
import { EIP6963ProviderDetail, EIP6963ProviderInfo } from '@shared/types/eip6963';

/**
 * @deprecated Legacy injection method. Can be removed since modern dapps use EIP-6963 provider discovery
 */ // @ts-ignore
window.ethereum = new Provider();

// strictly speaking, we are not required to use CSPRNG here, we just need a unique uuid to identify our wallet
const STATIC_UUID = '6c617965-727a-7761-6C6C-657400000000';

/**
 * Implements EIP-6963 provider discovery by wrapping our Provider instance
 *
 * @see https://eip6963.org
 * @see https://eips.ethereum.org/EIPS/eip-6963
 */
function onPageLoad() {
  const provider = new Provider();
  // @ts-ignore wtf, not in spec, is expected on https://metamask.github.io/test-dapp/ when doing Wallet Connect
  provider.signer = { uri: STATIC_UUID };

  function announceProvider() {
    console.log('announceProvider()');
    const info: EIP6963ProviderInfo = {
      uuid: STATIC_UUID,
      name: 'Layerz Wallet',
      // eslint-disable-next-line max-len
      icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTg2IiBoZWlnaHQ9IjE2NiIgdmlld0JveD0iMCAwIDE4NiAxNjYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxODYiIGhlaWdodD0iMTY2IiBmaWxsPSIjMDAwMDAwIi8+CjxwYXRoIGQ9Ik05Ni42NTU0IDEwMC42NDJIMjMuNTIyM0MxNy4zODg4IDEwMC42NDIgMTQuMjg5MSA5My4yNTkgMTguNTcyMyA4OC44ODJMNjMuMjA3MyA0My4yNTEyQzY3LjU2NTYgMzguNzk5IDczLjUzMDEgMzYuMjkxIDc5Ljc1NzYgMzYuMjkxSDE1Mi44OTFDMTU5LjAyNCAzNi4yOTEgMTYyLjEyNCA0My42NzM5IDE1Ny44NDEgNDguMDUwOUwxMTMuMjA2IDkzLjY4MTdDMTA4Ljg0NyA5OC4xMzM5IDEwMi44ODMgMTAwLjY0MiA5Ni42NTU0IDEwMC42NDJaIiBmaWxsPSJ1cmwoI3BhaW50MF9saW5lYXJfMl8zMzMyKSIvPgo8cGF0aCBkPSJNODkuNDY5NSA2NS4zNTc3SDE2Mi42MDNDMTY4LjczNiA2NS4zNTc3IDE3MS44MzYgNzIuNzQwNSAxNjcuNTUzIDc3LjExNzZMMTIyLjkxOCAxMjIuNzQ4QzExOC41NTkgMTI3LjIgMTEyLjU5NSAxMjkuNzA4IDEwNi4zNjcgMTI5LjcwOEgzMy4yMzQzQzI3LjEwMDcgMTI5LjcwOCAyNC4wMDEgMTIyLjMyNiAyOC4yODQyIDExNy45NDhMNzIuOTE5MiA3Mi4zMTc4Qzc3LjI3NzUgNjcuODY1NiA4My4yNDIgNjUuMzU3NyA4OS40Njk1IDY1LjM1NzdaIiBmaWxsPSJ1cmwoI3BhaW50MV9saW5lYXJfMl8zMzMyKSIvPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJwYWludDBfbGluZWFyXzJfMzMzMiIgeDE9IjE2LjY2MzgiIHkxPSIxMDAiIHgyPSIxNjAuMjA1IiB5Mj0iNDAuOTYzMiIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgo8c3RvcCBzdG9wLWNvbG9yPSJ3aGl0ZSIgc3RvcC1vcGFjaXR5PSIwIi8+CjxzdG9wIG9mZnNldD0iMC44NSIgc3RvcC1jb2xvcj0id2hpdGUiLz4KPC9saW5lYXJHcmFkaWVudD4KPGxpbmVhckdyYWRpZW50IGlkPSJwYWludDFfbGluZWFyXzJfMzMzMiIgeDE9IjE2OS45MDciIHkxPSI2NS44MzEiIHgyPSIyNi4zNjY0IiB5Mj0iMTI0Ljg2OCIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgo8c3RvcCBzdG9wLWNvbG9yPSJ3aGl0ZSIgc3RvcC1vcGFjaXR5PSIwIi8+CjxzdG9wIG9mZnNldD0iMC44NSIgc3RvcC1jb2xvcj0id2hpdGUiLz4KPC9saW5lYXJHcmFkaWVudD4KPC9kZWZzPgo8L3N2Zz4K',
      rdns: 'com.layerzwallet.layerzwallet',
    };

    const detail: EIP6963ProviderDetail = Object.freeze({ info, provider });
    window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail }));
  }

  window.addEventListener('eip6963:requestProvider', (event) => {
    console.log('Received EIP-6963 provider request');
    announceProvider();
  });

  announceProvider();
}

window.addEventListener('load', onPageLoad);

export {};
