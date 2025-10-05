import BigNumber from 'bignumber.js';
import useSWR from 'swr';

import { SparkWallet } from '@shared/class/wallets/spark-wallet';
import { ArkWallet } from '../class/wallets/ark-wallet';
import { getRpcProvider } from '../models/network-getters';
import { IBackgroundCaller } from '../types/IBackgroundCaller';
import { NETWORK_ARKADE, NETWORK_ARKADE_MUTINYNET, NETWORK_BITCOIN, NETWORK_LIGHTNING, NETWORK_LIGHTNING_TESTNET, NETWORK_LIQUID, NETWORK_LIQUID_TESTNET, NETWORK_SPARK, Networks } from '../types/networks';
import { StringNumber } from '../types/string-number';
import assert from 'assert';

interface balanceFetcherArg {
  cacheKey: string;
  accountNumber: number;
  network: Networks;
  backgroundCaller: IBackgroundCaller;
}

/**
 * extra key `backgroundCaller` can mutate unpredictably, causing more cache saves, and messing up logic
 * of useAccountBalance hook. this middleware removes it from the key
 */
function keyCleanupMiddleware(useSWRNext: any) {
  return (key: any, fetcher: any, config: any) => {
    let newKey = key;
    if (typeof key === 'object' && key.backgroundCaller) {
      newKey = Object.assign({}, key);
      delete newKey.backgroundCaller;
    }

    console.log(`useBalance(${JSON.stringify(newKey)})`); // logging

    return useSWRNext(newKey, () => fetcher(key), config);
  };
}

export const balanceFetcher = async (arg: balanceFetcherArg): Promise<StringNumber | undefined> => {
  const { accountNumber, network, backgroundCaller } = arg;
  if (typeof accountNumber === 'undefined' || !network) return undefined;

  if (network === NETWORK_LIGHTNING || network === NETWORK_LIGHTNING_TESTNET) {
    // LN is a metalayer which is composed of several actual wallets that support ln
    throw new Error('This should never happen: balance requested for NETWORK_LIGHTNING');
  }

  /**
   * EVM chains can get the balance on the spot (inside context of a Popup) since its a single api call
   * for a single address. For Bitcoin, we pass the call to a background script (and we ignore address argument)
   */
  if (network === NETWORK_BITCOIN) {
    const balance = await backgroundCaller.getBtcBalance(accountNumber);
    return (balance.confirmed + balance.unconfirmed).toString(10);
  }

  if (network === NETWORK_LIQUID || network === NETWORK_LIQUID_TESTNET) {
    const bw = await backgroundCaller.lazyInitWallet(network, accountNumber);
    const balance = await bw.getBalance();
    return balance.toString(10);
  }

  if (network === NETWORK_SPARK) {
    const start = +new Date();
    const sw = await backgroundCaller.lazyInitWallet(network, accountNumber);
    assert(sw instanceof SparkWallet);
    const virtualBalance = await sw.getOffchainBalance();
    const end = +new Date();
    console.log('spark balance took', (end - start) / 1000, 'sec, balance =', virtualBalance.toString(10));
    return virtualBalance.toString(10);
  }

  if (network === NETWORK_ARKADE_MUTINYNET || network === NETWORK_ARKADE) {
    const start = +new Date();
    const aw = await backgroundCaller.lazyInitWallet(network, accountNumber);
    assert(aw instanceof ArkWallet);
    const virtualBalance = await aw.getOffchainBalance();
    const end = +new Date();
    console.log('arkade balance took', (end - start) / 1000, 'sec, balance =', virtualBalance.toString(10));
    return virtualBalance.toString(10);
  }

  const address = await backgroundCaller.getAddress(network, accountNumber);
  const rpc = getRpcProvider(network);

  const res = await rpc.send('eth_getBalance', [String(address), 'latest']);
  const bn = new BigNumber(res);
  return bn.toString(10);
};

export function useBalance(network: Networks, accountNumber: number, backgroundCaller: IBackgroundCaller) {
  let refreshInterval = 12_000; // ETH block time

  switch (network) {
    case NETWORK_SPARK:
    case NETWORK_ARKADE_MUTINYNET:
      refreshInterval = 5_000; // transfers are just server interactions, should be fast
      break;

    case NETWORK_LIGHTNING:
    case NETWORK_LIGHTNING_TESTNET:
    case NETWORK_LIQUID:
    case NETWORK_LIQUID_TESTNET:
      refreshInterval = 5_000; // we are just fetching data from the SDK, should be fast
      break;

    case NETWORK_BITCOIN:
      refreshInterval = 60_000; // 1 min for btc
  }

  const arg: balanceFetcherArg = { cacheKey: 'balanceFetcher', accountNumber, network, backgroundCaller };
  const { data, error, isLoading } = useSWR(arg, balanceFetcher, {
    use: [keyCleanupMiddleware],
    refreshInterval,
    refreshWhenHidden: false,
    keepPreviousData: true,
  });

  return {
    balance: data,
    isLoading,
    error,
  };
}
