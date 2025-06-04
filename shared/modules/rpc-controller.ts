import BigNumber from 'bignumber.js';

import { DEFAULT_NETWORK } from '../config';
import { getChainIdByNetwork, getNetworkByChainId, getRpcProvider } from '../models/network-getters';
import { STORAGE_SELECTED_ACCOUNT_NUMBER } from '../hooks/AccountNumberContext';
import { STORAGE_SELECTED_NETWORK } from '../hooks/NetworkContext';
import { IBackgroundCaller } from '../types/IBackgroundCaller';
import { Messenger } from './messenger';
import { NETWORK_ROOTSTOCK, Networks } from '../types/networks';

import { IStorage } from '../types/IStorage';
import { DappPermissions } from '../class/dapp-permissions';

export async function processRPC(LayerzStorage: IStorage, BackgroundCaller: IBackgroundCaller, method: string, params: any, id: number, from: string) {
  const network: Networks = ((await LayerzStorage.getItem(STORAGE_SELECTED_NETWORK)) || DEFAULT_NETWORK) as Networks;
  const whitelist = await BackgroundCaller.getWhitelist();
  const accountNumber: number = Number(await LayerzStorage.getItem(STORAGE_SELECTED_ACCOUNT_NUMBER)) || 0;

  BackgroundCaller.log('processRPC: ' + method + '(' + JSON.stringify({ from, id, method, params, network }) + ')');

  switch (method) {
    case 'wallet_getPermissions':
      const dp = new DappPermissions(from, LayerzStorage);
      const permissions = await dp.getPermissions();
      await Messenger.sendResponseFromContentScriptToContentScript({ for: 'webpage', id: id, response: permissions });
      return { success: true };

    case 'wallet_revokePermissions':
      // Revoke permissions immediately without requiring user confirmation
      const dp2 = new DappPermissions(from, LayerzStorage);
      await dp2.revokePermissions(params[0]);
      await Messenger.sendResponseFromContentScriptToContentScript({ for: 'webpage', id: id, response: null });
      return { success: true };

    case 'eth_accounts':
      const responseForEthAccounts: string[] = [];
      if (whitelist.includes(from)) {
        // Dapp is already whitelisted, so we can return addresses without showing approval screen
        const addressResponse = await BackgroundCaller.getAddress(NETWORK_ROOTSTOCK, accountNumber); // most likely dapp is interested in EVM address specifically, NOT of currently-selected network
        responseForEthAccounts.push(addressResponse);
      }
      await Messenger.sendResponseFromContentScriptToContentScript({
        for: 'webpage',
        id: id,
        response: responseForEthAccounts,
      });
      return { success: true };

    case 'eth_requestAccounts':
      if (whitelist.includes(from)) {
        // Dapp is whitelisted, so we can respond immediately without showing approval screen
        const addressResponse = await BackgroundCaller.getAddress(NETWORK_ROOTSTOCK, accountNumber); // most likely dapp is interested in EVM address specifically, NOT of currently-selected network
        await Messenger.sendResponseFromContentScriptToContentScript({
          for: 'webpage',
          id: id,
          response: [addressResponse],
        });
        return { success: true };
      }
      break;

    case 'wallet_switchEthereumChain':
      // asking permission for network change is old news, although we still support it in the
      // dedicated screen.
      // we can reply on the spot if we support such network. if we dont support it
      // we fallback to popup opening that will display the message "its not supported".
      // technically, permission to chance network can only be shown by a dapp that wasnt whitelisted yet
      if (whitelist.includes(from)) {
        const net = getNetworkByChainId(params?.[0]?.chainId); // @see https://docs.metamask.io/wallet/reference/json-rpc-methods/wallet_switchethereumchain/
        if (net) {
          await new Promise((resolve) => setTimeout(resolve, 500)); // sleep to propagate
          // network supported by us
          await LayerzStorage.setItem(STORAGE_SELECTED_NETWORK, net);
          await Messenger.sendResponseFromContentScriptToContentScript({
            for: 'webpage',
            id: id,
            response: null,
          });

          // triggering event for any connected Dapp:
          await new Promise((resolve) => setTimeout(resolve, 500)); // sleep to propagate
          Messenger.documentDispatchEvent({
            for: 'webpage',
            type: 'eventCallback',
            event: 'chainChanged',
            arg: getChainIdByNetwork(net) as string,
          });

          return { success: true };
        }
      }
      break;

    case 'eth_chainId':
      // can just reply with a chainId, no need to show a screen for that
      await Messenger.sendResponseFromContentScriptToContentScript({
        for: 'webpage',
        id: id,
        response: getChainIdByNetwork(network),
      });
      return { success: true };

    /** @deprecated ? */
    case 'net_version':
      // can just reply with a chainId, no need to show a screen for that
      await Messenger.sendResponseFromContentScriptToContentScript({
        for: 'webpage',
        id: id,
        response: new BigNumber(getChainIdByNetwork(network) ?? '0x1').toNumber(),
      });
      return { success: true };

    case 'wallet_watchAsset':
      // Token watching requests are currently unimplemented. Return success to avoid errors.
      // TODO: handle tokens, since we can watch them with RPC calls to the smart contract via RPCprovider
      await Messenger.sendResponseFromContentScriptToContentScript({ for: 'webpage', id: id, response: true });
      return { success: true };

    case 'web3_clientVersion':
      await Messenger.sendResponseFromContentScriptToContentScript({ for: 'webpage', id: id, response: 'LayerzWallet/1.0.0' });
      return { success: true };

    // Forward these RPC calls directly to the provider without user confirmation
    case 'eth_maxPriorityFeePerGas':
    case 'eth_getBalance':
    case 'eth_getLogs':
    case 'eth_getTransactionCount':
    case 'eth_estimateGas':
    case 'eth_gasPrice':
    case 'eth_getTransactionReceipt':
    case 'eth_blockNumber':
    case 'eth_getCode':
    case 'eth_coinbase':
    case 'eth_feeHistory':
    case 'eth_getBlockByHash':
    case 'eth_getBlockTransactionCountByHash':
    case 'eth_getBlockTransactionCountByNumber':
    case 'eth_getFilterLogs':
    case 'eth_getProof':
    case 'eth_getStorageAt':
    case 'eth_getTransactionByBlockHashAndIndex':
    case 'eth_getTransactionByBlockNumberAndIndex':
    case 'eth_getUncleCountByBlockHash':
    case 'eth_getUncleCountByBlockNumber':
    case 'eth_newBlockFilter':
    case 'eth_newPendingTransactionFilter':
    case 'eth_sendRawTransaction':
    case 'eth_syncing':
    case 'eth_unsubscribe': // subs/unsubs are unhandled...
    case 'eth_subscribe': // subs/unsubs are unhandled...
    case 'eth_getFilterChanges': // subs/unsubs are unhandled...
    case 'eth_uninstallFilter': // subs/unsubs are unhandled...
    case 'eth_newFilter': // subs/unsubs are unhandled...ssss
    case 'eth_getTransactionByHash':
    case 'eth_call':
    case 'eth_getBlockByNumber':
      try {
        const rpc = getRpcProvider(network);
        const response = await rpc.send(method, params);
        await Messenger.sendResponseFromContentScriptToContentScript({ for: 'webpage', id: id, response });
      } catch (e: any) {
        console.warn('rpc error for', method, ':', e);
        await Messenger.sendResponseFromContentScriptToContentScript({ for: 'webpage', id: id, error: e.error });
      }

      return { success: true };

    case 'eth_sendTransaction':
    case 'personal_sign':
    case 'eth_signTypedData_v4':
    case 'wallet_requestPermissions':
    // These operations require user approval via popup UI, so fall through to default case
  }

  console.log('forwarding request to background script for user approval...');
  // Forward request to background script to handle via popup UI since this requires user approval
  return BackgroundCaller.openPopup(method, params, id, from);
}
