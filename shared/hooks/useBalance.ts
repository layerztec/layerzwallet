import BigNumber from 'bignumber.js';
import useSWR from 'swr';

import { NETWORK_ARKMUTINYNET, NETWORK_BITCOIN, NETWORK_BREEZ, NETWORK_BREEZTESTNET, NETWORK_LIQUID, NETWORK_LIQUIDTESTNET, Networks } from '../types/networks';
import { StringNumber } from '../types/string-number';
import { IBackgroundCaller } from '../types/IBackgroundCaller';
import { getRpcProvider } from '../models/network-getters';
import { ArkWallet } from '../class/wallets/ark-wallet';
import { lbtcAssetId } from '../class/wallets/liquid-wallet';
import { BreezWallet } from '../class/wallets/breez-wallet';

interface balanceFetcherArg {
  cacheKey: string;
  accountNumber: number;
  network: Networks;
  backgroundCaller: IBackgroundCaller;
}

export const balanceFetcher = async (arg: balanceFetcherArg): Promise<StringNumber | undefined> => {
  const { accountNumber, network, backgroundCaller } = arg;
  if (typeof accountNumber === 'undefined' || !network) return undefined;

  /**
   * EVM chains can get the balance on the spot (inside context of a Popup) since its a single api call
   * for a single address. For Bitcoin, we pass the call to a background script (and we ignore address argument)
   */
  if (network === NETWORK_BITCOIN) {
    const balance = await backgroundCaller.getBtcBalance(accountNumber);
    return (balance.confirmed + balance.unconfirmed).toString(10);
  }

  if (network === NETWORK_LIQUIDTESTNET || network === NETWORK_LIQUID) {
    // for Liquid, we only show balance of LBTC token
    const balances = await backgroundCaller.getLiquidBalance(network, accountNumber);
    let balance = 0;
    for (const [k, v] of Object.entries(balances)) {
      if (k === lbtcAssetId[network]) {
        balance += v;
      }
    }
    return balance.toString(10);
  }

  if (network === NETWORK_BREEZ || network === NETWORK_BREEZTESTNET) {
    const mnemonic = await backgroundCaller.getSubMnemonic(accountNumber);
    const bNetwork = network === NETWORK_BREEZ ? 'mainnet' : 'testnet';
    const bw = new BreezWallet(mnemonic, bNetwork);
    const balance = await bw.getBalance();
    return balance.toString(10);
  }

  if (network === NETWORK_ARKMUTINYNET) {
    const address = await backgroundCaller.getAddress(network, accountNumber);
    const aw = new ArkWallet();
    const virtualBalance = await aw.getOffchainBalanceForAddress(address);
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
    case NETWORK_BITCOIN:
    case NETWORK_LIQUIDTESTNET:
      refreshInterval = 60_000; // 1 min for btc
  }
  const { data, error, isLoading } = useSWR({ cacheKey: 'balanceFetcher', accountNumber, network, backgroundCaller } as balanceFetcherArg, balanceFetcher, {
    refreshInterval,
    refreshWhenHidden: false,
  });

  return {
    balance: data,
    isLoading,
    error,
  };
}
