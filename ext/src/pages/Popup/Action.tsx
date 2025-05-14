import React, { useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { BackgroundCaller } from '../../modules/background-caller';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { Messenger } from '@shared/modules/messenger';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { DEFAULT_NETWORK } from '@shared/config';
import { SwitchEthereumChain } from './ActionComponents/SwitchEthereumChain';
import { EthRequestAccounts } from './ActionComponents/EthRequestAccounts';
import { PersonalSign } from './ActionComponents/PersonalSign';
import { EthSignTypedData } from './ActionComponents/EthSignTypedData';
import { WalletRequestPermissions } from './ActionComponents/WalletRequestPermissions';
import { SendTransaction } from './ActionComponents/SendTransaction';

// actual evm rpc methods, plus our own custom `Loading` to render the loading state
type EvmRpcMethod = 'wallet_switchEthereumChain' | 'personal_sign' | 'eth_signTypedData_v4' | 'wallet_requestPermissions' | 'eth_sendTransaction' | 'eth_requestAccounts' | 'eth_accounts' | 'Loading';

/**
 * basically this is a parent screen component that only unwraps GET params for the action, and passes them to a
 * sub-component to do an actual action
 */
const Action: React.FC = () => {
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { search } = useLocation();
  const [method, setMethod] = useState<EvmRpcMethod>('Loading'); // describing state of a parent component, and which sub-component it should render
  const [params, setParams] = useState<any[]>([]);
  const [from, setFrom] = useState<string>('');
  const [id, setId] = useState<string>('');

  useEffect(() => {
    (async () => {
      const searchParams = new URLSearchParams(search);
      console.log('search', search);
      const methodFromParams: EvmRpcMethod = searchParams.get('method') as EvmRpcMethod;
      setMethod(methodFromParams);
      let paramsFromState;

      try {
        paramsFromState = JSON.parse(searchParams.get('params') ?? '');
      } catch (_) {
        paramsFromState = [];
      }

      setParams(paramsFromState);
      const fromFromState = searchParams.get('from');
      setFrom(fromFromState ?? '');
      const idFromState = searchParams.get('id');
      setId(idFromState ?? '');

      const whitelist = await BackgroundCaller.getWhitelist();

      if (methodFromParams === 'eth_requestAccounts' || methodFromParams === 'eth_accounts') {
        if (fromFromState && whitelist.includes(fromFromState)) {
          // no need to ask for an approval in a dedicated screen, approval is already granted, we just need to reply
          const addressResponse = await BackgroundCaller.getAddress(network ?? DEFAULT_NETWORK, accountNumber);
          await Messenger.sendResponseToActiveTabsFromPopupToContentScript({ for: 'webpage', id: Number(idFromState), response: [addressResponse] });
          await new Promise((resolve) => setTimeout(resolve, 100)); // propagate
          window.close();
        } else {
          setMethod('eth_requestAccounts');
        }
      }
    })();
  }, [network, accountNumber, search]);

  const renderMethodComponent = () => {
    switch (method) {
      case 'Loading':
        return <div>Loading...</div>;
      case 'wallet_switchEthereumChain':
        return <SwitchEthereumChain params={params} id={id} from={from} />;
      case 'personal_sign':
        return <PersonalSign params={params} id={id} from={from} />;
      case 'eth_signTypedData_v4':
        return <EthSignTypedData params={params} id={id} from={from} />;
      case 'wallet_requestPermissions':
        return <WalletRequestPermissions params={params} id={id} from={from} />;
      case 'eth_sendTransaction':
        return <SendTransaction params={params} id={id} from={from} />;
      case 'eth_requestAccounts':
        return <EthRequestAccounts params={params} id={id} from={from} />;
      default:
        return <div>Unknown method: {method}</div>;
    }
  };

  return (
    <div>
      <h2>Action required</h2>
      {renderMethodComponent()}
    </div>
  );
};

export default Action;
