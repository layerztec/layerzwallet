import BigNumber from 'bignumber.js';

import { DappPermissions } from '../class/dapp-permissions';
import { DEFAULT_NETWORK } from '../config';
import { STORAGE_SELECTED_ACCOUNT_NUMBER } from '../hooks/AccountNumberContext';
import { STORAGE_SELECTED_NETWORK } from '../hooks/NetworkContext';
import { getChainIdByNetwork, getNetworkByChainId, getRpcProvider } from '../models/network-getters';
import { IBackgroundCaller } from '../types/IBackgroundCaller';
import { IStorage } from '../types/IStorage';
import { NETWORK_ROOTSTOCK, Networks } from '../types/networks';
import { IMessenger } from './messenger';

export async function processRPC(LayerzStorage: IStorage, BackgroundCaller: IBackgroundCaller, method: string, params: any, id: number, from: string, Messenger: IMessenger) {
  const network: Networks = ((await LayerzStorage.getItem(STORAGE_SELECTED_NETWORK)) || DEFAULT_NETWORK) as Networks;
  const whitelist = await BackgroundCaller.getWhitelist();
  const accountNumber: number = Number(await LayerzStorage.getItem(STORAGE_SELECTED_ACCOUNT_NUMBER)) || 0;
  const sendResponse = Messenger.sendResponseFromContentScriptToContentScript;

  BackgroundCaller.log('processRPC: ' + method + '(' + JSON.stringify({ from, id, method, params, network }) + ')');

  switch (method) {
    case 'wallet_getPermissions':
      const dp = new DappPermissions(from, LayerzStorage);
      const permissions = await dp.getPermissions();
      await sendResponse({ for: 'webpage', id, response: permissions });
      return { success: true };

    case 'wallet_revokePermissions':
      // Revoke permissions immediately without requiring user confirmation
      const dp2 = new DappPermissions(from, LayerzStorage);
      await dp2.revokePermissions(params[0]);
      await BackgroundCaller.unwhitelistDapp(from);
      await sendResponse({ for: 'webpage', id, response: null });
      // Notify the dapp that accounts are now disconnected
      Messenger.documentDispatchEvent({
        for: 'webpage',
        type: 'eventCallback',
        event: 'accountsChanged',
        arg: [],
      });
      return { success: true };

    case 'eth_accounts':
      const responseForEthAccounts: string[] = [];
      if (whitelist.includes(from)) {
        // Dapp is already whitelisted, so we can return addresses without showing approval screen
        const addressResponse = await BackgroundCaller.getAddress(NETWORK_ROOTSTOCK, accountNumber); // most likely dapp is interested in EVM address specifically, NOT of currently-selected network
        responseForEthAccounts.push(addressResponse);
        await sendResponse({
          for: 'webpage',
          id,
          response: responseForEthAccounts,
        });
        return { success: true };
      }
      // If not whitelisted, return empty array per EIP-1193 (no popup for eth_accounts)
      await sendResponse({
        for: 'webpage',
        id,
        response: [],
      });
      return { success: true };

    case 'eth_requestAccounts':
      if (whitelist.includes(from)) {
        // Dapp is whitelisted, so we can respond immediately without showing approval screen
        const addressResponse = await BackgroundCaller.getAddress(NETWORK_ROOTSTOCK, accountNumber); // most likely dapp is interested in EVM address specifically, NOT of currently-selected network
        await sendResponse({
          for: 'webpage',
          id,
          response: [addressResponse],
        });
        return { success: true };
      }
      break;

    case 'wallet_switchEthereumChain': {
      // Auto-switch without a confirmation popup: if we support the chain we switch,
      // otherwise we reject with EIP-3326 code 4902 so the dapp stops looping.
      // @see https://docs.metamask.io/wallet/reference/json-rpc-methods/wallet_switchethereumchain/
      const net = getNetworkByChainId(params?.[0]?.chainId);
      if (!net) {
        await sendResponse({
          for: 'webpage',
          id,
          error: { code: 4902, message: `Unrecognized chain ID "${params?.[0]?.chainId}". Try adding the chain first.` },
        });
        return { success: true };
      }

      await LayerzStorage.setItem(STORAGE_SELECTED_NETWORK, net);
      await sendResponse({ for: 'webpage', id, response: null });

      // triggering event for any connected Dapp:
      await new Promise((resolve) => setTimeout(resolve, 500)); // sleep to propagate
      Messenger.documentDispatchEvent({
        for: 'webpage',
        type: 'eventCallback',
        event: 'chainChanged',
        arg: getChainIdByNetwork(net),
      });

      return { success: true };
    }

    case 'eth_chainId':
      // can just reply with a chainId, no need to show a screen for that
      await sendResponse({
        for: 'webpage',
        id,
        response: getChainIdByNetwork(network),
      });
      return { success: true };

    /** @deprecated ? */
    case 'net_version':
      // can just reply with a chainId, no need to show a screen for that
      await sendResponse({
        for: 'webpage',
        id,
        response: new BigNumber(getChainIdByNetwork(network)).toNumber(),
      });
      return { success: true };

    case 'wallet_watchAsset':
      // Token watching requests are currently unimplemented. Return success to avoid errors.
      // TODO: handle tokens, since we can watch them with RPC calls to the smart contract via RPCprovider
      await sendResponse({ for: 'webpage', id, response: true });
      return { success: true };

    case 'web3_clientVersion':
      await sendResponse({ for: 'webpage', id, response: 'LayerzWallet/1.0.0' });
      return { success: true };

    case 'wallet_getCapabilities':
      // TODO: not supported. not sure if we need it..?
      // @see https://eips.ethereum.org/EIPS/eip-5792
      // @see https://docs.metamask.io/wallet/reference/json-rpc-methods/wallet_getcapabilities
      await sendResponse({ for: 'webpage', id, response: {} });
      return { success: true };

    case 'eth_maxPriorityFeePerGas':
      // Rootstock doesn't implement EIP-1559 and replies with JSON-RPC -32601 for this
      // method, which makes EIP-1559-assuming dapps (e.g. oku.trade) hang during connect.
      // Short-circuit with gasPrice so the dapp's fee pipeline can proceed.
      if (network === NETWORK_ROOTSTOCK) {
        try {
          const gasPrice = await getRpcProvider(network).send('eth_gasPrice', []);
          await sendResponse({ for: 'webpage', id, response: gasPrice });
        } catch {
          await sendResponse({ for: 'webpage', id, response: '0x0' });
        }
        return { success: true };
      }
    // falls through to the generic forwarder below for all other networks

    case 'eth_feeHistory':
      // Same reason as eth_maxPriorityFeePerGas: Rootstock rejects this with -32601.
      // Synthesize a minimal valid response so the dapp can compute a fee.
      if (network === NETWORK_ROOTSTOCK) {
        const blockCount = Number(new BigNumber((params?.[0] ?? '0x1').toString()).toString(10)) || 1;
        let gasPrice = '0x0';
        try {
          gasPrice = await getRpcProvider(network).send('eth_gasPrice', []);
        } catch {
          // keep '0x0'
        }
        await sendResponse({
          for: 'webpage',
          id,
          response: {
            oldestBlock: '0x0',
            baseFeePerGas: new Array(blockCount + 1).fill('0x0'),
            gasUsedRatio: new Array(blockCount).fill(0),
            reward: new Array(blockCount).fill([gasPrice]),
          },
        });
        return { success: true };
      }
    // falls through to the generic forwarder below for all other networks

    // Forward these RPC calls directly to the provider without user confirmation
    case 'eth_getBalance':
    case 'eth_getLogs':
    case 'eth_getTransactionCount':
    case 'eth_estimateGas':
    case 'eth_gasPrice':
    case 'eth_getTransactionReceipt':
    case 'eth_blockNumber':
    case 'eth_getCode':
    case 'eth_coinbase':
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
        await sendResponse({ for: 'webpage', id, response });
      } catch (e: any) {
        globalThis.handleError?.(e, 'rpc-controller.ts');
        console.warn('rpc error for', method, ':', e);
        await sendResponse({ for: 'webpage', id, error: e.error });
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
