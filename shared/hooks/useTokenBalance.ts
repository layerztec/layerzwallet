import useSWR from 'swr';
import { NETWORK_BITCOIN, NETWORK_ROOTSTOCK, Networks } from '../types/networks';
import { StringNumber } from '../types/string-number';
import { IBackgroundCaller } from '../types/IBackgroundCaller';
import { ethers } from 'ethers';
import { getRpcProvider } from '../models/network-getters';

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

  /**
   * EVM chains can get the balance on the spot (inside context of a Popup) since its a single api call
   * for a single address. For Bitcoin, we pass the call to a background script (and we ignore address argument)
   */
  if (network === NETWORK_BITCOIN) {
    throw new Error('tokenBalanceFetcher: not supported');
  }

  const address = await backgroundCaller.getAddress(network, accountNumber);
  const rpc = getRpcProvider(network);

  // Define the ERC-20 token contract ABI (Application Binary Interface)
  const abi = ['function balanceOf(address owner) view returns (uint256)', 'function name() view returns (string)', 'function symbol() view returns (string)'];

  // Create a contract instance
  const contract = new ethers.Contract(tokenContractAddress, abi, rpc);

  // Fetch the token balance
  const balance = await contract.balanceOf(address);

  /*// Fetch token name and symbol for better readability
  const name = await contract.name();
  const symbol = await contract.symbol();

  // Format the balance to display it correctly (assuming 18 decimals)
  const formattedBalance = ethers.formatUnits(balance, 18);

  console.log(`Balance of ${address} for ${name} (${symbol}): ${formattedBalance}`);*/

  return String(balance);
};

export function useTokenBalance(network: Networks, accountNumber: number, tokenContractAddress: string, backgroundCaller: IBackgroundCaller) {
  let refreshInterval = 12_000; // ETH block time

  switch (network) {
    case NETWORK_ROOTSTOCK:
      refreshInterval = 30_000;
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
