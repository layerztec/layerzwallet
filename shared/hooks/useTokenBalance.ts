import useSWR from 'swr';
import assert from 'assert';
import { ethers } from 'ethers';

import { NETWORK_BITCOIN, NETWORK_LIQUID, NETWORK_LIQUID_TESTNET, NETWORK_ROOTSTOCK, NETWORK_SPARK, NETWORK_STACKS, Networks } from '../types/networks';
import { StringNumber } from '../types/string-number';
import { IBackgroundCaller } from '../types/IBackgroundCaller';
import { getIsEVM, getRpcProvider } from '../models/network-getters';
import { SparkWallet } from '../class/wallets/spark-wallet';
import { BreezWallet } from '../class/wallets/breez-wallet';
import { StacksWallet } from '@shared/class/wallets/stacks-wallet';

interface tokenBalanceFetcherArg {
  cacheKey: string;
  accountNumber: number;
  network: Networks;
  tokenContractAddress: string;
  backgroundCaller: IBackgroundCaller;
}

export const tokenBalanceFetcher = async (arg: tokenBalanceFetcherArg): Promise<StringNumber | undefined> => {
  const { accountNumber, network, tokenContractAddress, backgroundCaller } = arg;
  if (typeof accountNumber === 'undefined' || !network) return undefined;

  try {
    /**
     * EVM chains can get the balance on the spot (inside context of a Popup) since its a single api call
     * for a single address. For Bitcoin, we pass the call to a background script (and we ignore address argument)
     */
    if (network === NETWORK_BITCOIN) {
      throw new Error('tokenBalanceFetcher: not supported');
    }

    if (network === NETWORK_SPARK) {
      const wallet = await backgroundCaller.lazyInitWallet(network, accountNumber);
      assert(wallet instanceof SparkWallet, 'Not a Spark wallet');
      // Find the token balance where tokenMetadata.tokenPublicKey matches tokenContractAddress
      const tokenBalances = wallet.getTokenBalances();
      for (const value of tokenBalances.values()) {
        if (value.tokenMetadata.tokenPublicKey === tokenContractAddress) {
          return String(value.balance);
        }
      }
      return undefined;
    } else if (network === NETWORK_STACKS) {
      const wallet = await backgroundCaller.lazyInitWallet(network, accountNumber);
      assert(wallet instanceof StacksWallet, 'Not a Stacks wallet');
      const tokenBalances = wallet.getTokenBalances();
      for (const value of tokenBalances.values()) {
        if (value.id === tokenContractAddress) {
          return String(value.balance);
        }
      }
      return undefined;
    } else if (network === NETWORK_LIQUID || network === NETWORK_LIQUID_TESTNET) {
      const wallet = await backgroundCaller.lazyInitWallet(network, accountNumber);
      assert(wallet instanceof BreezWallet, 'Not a Breez wallet');
      const balances = await wallet.getAssetBalances();
      for (const balance of balances) {
        if (balance.assetId === tokenContractAddress) {
          return String(balance.balanceSat);
        }
      }
      return undefined;
    }

    if (!getIsEVM(network)) {
      throw new Error('tokenBalanceFetcher: attempt to fetch balance on non-EVM network');
    }

    const address = await backgroundCaller.getAddress(network, accountNumber);
    const rpc = getRpcProvider(network);

    // Define the ERC-20 token contract ABI (Application Binary Interface)
    const abi = ['function balanceOf(address owner) view returns (uint256)', 'function name() view returns (string)', 'function symbol() view returns (string)'];
    const checksummedAddress = ethers.getAddress(tokenContractAddress.toLowerCase());

    const contract = new ethers.Contract(checksummedAddress, abi, rpc);

    // Fetch the token balance
    const balance = await contract.balanceOf(ethers.getAddress(address));

    /*
    // Fetch token name and symbol for better readability
    const name = await contract.name();
    const symbol = await contract.symbol();

    // Format the balance to display it correctly (assuming 18 decimals)
    const formattedBalance = ethers.formatUnits(balance, 18);
    console.log(`Balance of ${address}: ${balance}`);
    */

    return String(balance);
  } catch (error: any) {
    console.log('tokenBalanceFetcher error = ', error.message);
    return undefined;
  }
};

export function useTokenBalance(network: Networks, accountNumber: number, tokenContractAddress: string, backgroundCaller: IBackgroundCaller) {
  let refreshInterval = 12_000; // ETH block time

  switch (network) {
    case NETWORK_ROOTSTOCK:
      refreshInterval = 30_000;
      break;

    case NETWORK_SPARK:
      refreshInterval = 2_000;
      break;
  }

  const arg: tokenBalanceFetcherArg = { cacheKey: 'tokenBalanceFetcher', accountNumber, network, tokenContractAddress, backgroundCaller };
  const { data, error, isLoading } = useSWR(arg, tokenBalanceFetcher, {
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
