import useSWR from 'swr';

import { CommonTransaction } from '@shared/types/common-transaction';
import { IBackgroundCaller } from '../types/IBackgroundCaller';
import {
  NETWORK_ALPEN_TESTNET,
  NETWORK_ARK_MUTINYNET,
  NETWORK_BITCOIN,
  NETWORK_BOTANIX,
  NETWORK_BOTANIX_TESTNET,
  NETWORK_LIGHTNING,
  NETWORK_LIGHTNING_TESTNET,
  NETWORK_LIQUID,
  NETWORK_LIQUID_TESTNET,
  NETWORK_ROOTSTOCK,
  NETWORK_SPARK,
  Networks,
} from '../types/networks';
import { EvmWallet } from '@shared/class/evm-wallet';
import { AllNetworkInfos } from '../models/all-network-infos';

interface txFetcherArg {
  cacheKey: string;
  accountNumber: number;
  network: Networks;
  backgroundCaller: IBackgroundCaller;
}

/**
 * extra key `backgroundCaller` can mutate unpredictably, causing more cache saves, and messing up logic. this middleware removes it from the key
 */
function keyCleanupMiddleware(useSWRNext: any) {
  return (key: any, fetcher: any, config: any) => {
    let newKey = key;
    if (typeof key === 'object' && key.backgroundCaller) {
      newKey = Object.assign({}, key);
      delete newKey.backgroundCaller;
    }

    return useSWRNext(newKey, () => fetcher(key), config);
  };
}

export const txFetcher = async (arg: txFetcherArg): Promise<CommonTransaction[]> => {
  const { accountNumber, network, backgroundCaller } = arg;
  if (network === NETWORK_BITCOIN) {
    return await backgroundCaller.getCommonTransactions(network, accountNumber);
  }

  if (network === NETWORK_LIQUID || network === NETWORK_LIQUID_TESTNET) {
    return await backgroundCaller.getCommonTransactions(network, accountNumber);
  }

  if (AllNetworkInfos[network].etherScanApiUrl) {
    try {
      const wallet = new EvmWallet();
      wallet.address = await backgroundCaller.getAddress(network, accountNumber);
      wallet.network = network;
      wallet.etherScanApiUrl = AllNetworkInfos[network].etherScanApiUrl;
      await wallet.fetchTransactions();
      const txs = wallet.getCommonTransactions();
      return txs;
    } catch (error) {
      console.error('tx fetch error', error);
      throw error;
    }
  }

  return [];
};

export function useTransactions(network: Networks, accountNumber: number, backgroundCaller: IBackgroundCaller) {
  let refreshInterval = 60_000; // 1 min

  switch (network) {
    case NETWORK_SPARK:
    case NETWORK_ARK_MUTINYNET:
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

  const arg: txFetcherArg = { cacheKey: 'txFetcher', accountNumber, network, backgroundCaller };
  const { data, error, isLoading } = useSWR(arg, txFetcher, {
    use: [keyCleanupMiddleware],
    refreshInterval,
    refreshWhenHidden: false,
    keepPreviousData: true,
  });

  return {
    transactions: data,
    isLoading,
    error,
  };
}
