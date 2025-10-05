import assert from 'assert';
import useSWR from 'swr';

import { EvmWallet } from '@shared/class/evm-wallet';
import { SparkWallet } from '@shared/class/wallets/spark-wallet';
import { ArkadeWallet } from '@shared/class/wallets/arkade-wallet';
import { CommonTransaction } from '@shared/types/common-transaction';
import { AllNetworkInfos } from '../models/all-network-infos';
import { IBackgroundCaller } from '../types/IBackgroundCaller';
import {
  NETWORK_ARKADE,
  NETWORK_ARKADE_MUTINYNET,
  NETWORK_BITCOIN,
  NETWORK_LIGHTNING,
  NETWORK_LIGHTNING_TESTNET,
  NETWORK_LIQUID,
  NETWORK_LIQUID_TESTNET,
  NETWORK_ROOTSTOCK,
  NETWORK_SPARK,
  NETWORK_USDT,
  Networks,
} from '../types/networks';
import { USDT_TOKENS } from '@shared/models/token-list';

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

  try {
    if ([NETWORK_BITCOIN, NETWORK_LIQUID, NETWORK_LIQUID_TESTNET].includes(network as any)) {
      return await backgroundCaller.getCommonTransactions(network, accountNumber);
    }

    if (AllNetworkInfos[network].etherScanApiUrl) {
      const wallet = new EvmWallet();
      wallet.address = await backgroundCaller.getAddress(network, accountNumber);
      wallet.network = network;
      wallet.etherScanApiUrl = AllNetworkInfos[network].etherScanApiUrl;
      await wallet.fetchTransactions();
      const txs = wallet.getCommonTransactions();
      return txs;
    }

    if (network === NETWORK_SPARK) {
      const wallet = await backgroundCaller.lazyInitWallet(network, accountNumber);
      assert(wallet instanceof SparkWallet, 'Not a Spark wallet');
      return await wallet.getCommonTransactions();
    }

    if (network === NETWORK_LIGHTNING || network === NETWORK_LIGHTNING_TESTNET) {
      // join Liquid and Spark, but spark is not available on testnet
      const liquidNetwork = network === NETWORK_LIGHTNING_TESTNET ? NETWORK_LIQUID_TESTNET : NETWORK_LIQUID;
      const tsx = await backgroundCaller.getCommonTransactions(liquidNetwork, accountNumber);
      if (network === NETWORK_LIGHTNING) {
        const sparkWallet = await backgroundCaller.lazyInitWallet(NETWORK_SPARK, accountNumber);
        assert(sparkWallet instanceof SparkWallet, 'Not a Spark wallet');
        const sparkTx = await sparkWallet.getCommonTransactions();
        tsx.push(...sparkTx);
        const arkadeWallet = await backgroundCaller.lazyInitWallet(NETWORK_ARKADE, accountNumber);
        assert(arkadeWallet instanceof ArkadeWallet, 'Not an Arkade wallet');
        const arkTx = arkadeWallet.getCommonTransactions();
        tsx.push(...arkTx);
      }
      return tsx
        .filter((tx) => tx?.amount !== undefined && tx.amount > 0) // filter out token transfers
        .sort((a, b) => b.timestamp - a.timestamp);
    }

    if (network === NETWORK_ARKADE_MUTINYNET || network === NETWORK_ARKADE) {
      const wallet = await backgroundCaller.lazyInitWallet(network, accountNumber);
      assert(wallet instanceof ArkadeWallet, 'Not an Arkade wallet');
      return await wallet.getCommonTransactions();
    }

    if (network === NETWORK_USDT) {
      // join Liquid and Rootstock, filter by token transactions
      const liquidTxs = await backgroundCaller.getCommonTransactions(NETWORK_LIQUID, accountNumber);
      const rootstockWallet = new EvmWallet();
      rootstockWallet.address = await backgroundCaller.getAddress(NETWORK_ROOTSTOCK, accountNumber);
      rootstockWallet.network = NETWORK_ROOTSTOCK;
      rootstockWallet.etherScanApiUrl = AllNetworkInfos[NETWORK_ROOTSTOCK].etherScanApiUrl;
      await rootstockWallet.fetchTransactions();
      const rootstockTxs = rootstockWallet.getCommonTransactions();
      const tsx = [...liquidTxs, ...rootstockTxs];
      const USDT_IDS = Object.values(USDT_TOKENS)
        .flatMap((network) => network)
        .map((id) => id.toLowerCase());
      return tsx
        .filter((tx) => {
          // show token transfers only
          return tx.tokenTransfers?.some((token) => USDT_IDS.includes(token.tokenId.toLowerCase()));
        })
        .sort((a, b) => b.timestamp - a.timestamp);
    }

    return [];
  } catch (error) {
    console.error('tx fetch error', error);
    throw error;
  }
};

export function useTransactions(network: Networks, accountNumber: number, backgroundCaller: IBackgroundCaller) {
  let refreshInterval = 60_000; // 1 min

  switch (network) {
    case NETWORK_SPARK:
    case NETWORK_ARKADE_MUTINYNET:
      refreshInterval = 20_000;
      break;

    case NETWORK_LIGHTNING:
    case NETWORK_LIGHTNING_TESTNET:
    case NETWORK_LIQUID:
    case NETWORK_LIQUID_TESTNET:
      refreshInterval = 20_000;
      break;

    case NETWORK_BITCOIN:
      refreshInterval = 60_000;
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
