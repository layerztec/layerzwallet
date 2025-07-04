import React, { useContext, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router';

import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { Messenger } from '@shared/modules/messenger';
import { EvmRpcMethod } from '@shared/types/evm-rpc-method';
import { ThemedText } from '../../components/ThemedText';
import { BackgroundCaller } from '../../modules/background-caller';
import { EthRequestAccounts } from './ActionComponents/EthRequestAccounts';
import { EthSignTypedData } from './ActionComponents/EthSignTypedData';
import { PersonalSign } from './ActionComponents/PersonalSign';
import { SendTransaction } from './ActionComponents/SendTransaction';
import { SwitchEthereumChain } from './ActionComponents/SwitchEthereumChain';
import { WalletRequestPermissions } from './ActionComponents/WalletRequestPermissions';

/**
 * basically this is a parent screen component that only unwraps GET params for the action, and passes them to a
 * sub-component to do an actual action
 */
const Action: React.FC = () => {
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { search } = useLocation();

  // Parse search parameters using useMemo for better performance and cleaner code
  const { id, method, from, params } = useMemo(() => {
    const searchParams = new URLSearchParams(search);

    let parsedParams: any[] = [];
    try {
      parsedParams = JSON.parse(searchParams.get('params') ?? '');
    } catch {
      parsedParams = [];
    }

    return {
      id: Number(searchParams.get('id') ?? ''),
      method: searchParams.get('method') as EvmRpcMethod,
      from: searchParams.get('from') ?? '',
      params: parsedParams,
    };
  }, [search]);

  useEffect(() => {
    const initializeAction = async () => {
      if (!method) {
        throw new Error('Method is required');
      }

      // Handle auto-approval for whitelisted dapps
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
        const whitelist = await BackgroundCaller.getWhitelist();
        if (whitelist.includes(from)) {
          // no need to ask for an approval in a dedicated screen, approval is already granted, we just need to reply
          const addressResponse = await BackgroundCaller.getAddress(network, accountNumber);
          await Messenger.sendResponseToActiveTabsFromPopupToContentScript({ for: 'webpage', id, response: [addressResponse] });
          await new Promise((resolve) => setTimeout(resolve, 100)); // propagate
          window.close();
          return;
        }
      }
    };

    initializeAction();
  }, [network, accountNumber, method, from, id]);

  const renderMethodComponent = () => {
    const componentProps = { params, id, from };

    switch (method) {
      case 'wallet_switchEthereumChain':
        return <SwitchEthereumChain {...componentProps} />;
      case 'personal_sign':
        return <PersonalSign {...componentProps} />;
      case 'eth_signTypedData_v4':
        return <EthSignTypedData {...componentProps} />;
      case 'wallet_requestPermissions':
        return <WalletRequestPermissions {...componentProps} />;
      case 'eth_sendTransaction':
        return <SendTransaction {...componentProps} />;
      case 'eth_requestAccounts':
        return <EthRequestAccounts {...componentProps} />;
      default:
        return (
          <div>
            <ThemedText>Unknown method: {method}</ThemedText>
          </div>
        );
    }
  };

  return (
    <div>
      <ThemedText type="headline">Action required</ThemedText>
      {renderMethodComponent()}
    </div>
  );
};

export default Action;
