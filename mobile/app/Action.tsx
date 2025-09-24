import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext, useEffect, useMemo } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { EthRequestAccounts } from '@/components/action/EthRequestAccounts';
import { EthSignTypedData } from '@/components/action/EthSignTypedData';
import { PersonalSign } from '@/components/action/PersonalSign';
import { SendTransaction } from '@/components/action/SendTransaction';
import { SwitchEthereumChain } from '@/components/action/SwitchEthereumChain';
import { WalletRequestPermissions } from '@/components/action/WalletRequestPermissions';
import { ThemedText } from '@/components/ThemedText';
import { BrowserBridge } from '@/src/class/browser-bridge';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { EvmRpcMethod } from '@shared/types/evm-rpc-method';

// Define the route parameters type
type ActionRouteParams = {
  method: EvmRpcMethod;
  params: string; // JSON stringified params
  from: string;
  id: string;
};

const Action: React.FC = () => {
  const router = useRouter();
  const routeParams = useLocalSearchParams<ActionRouteParams>();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);

  const { id, method, from, params } = useMemo(() => {
    let parsedParams: any[] = [];
    try {
      parsedParams = JSON.parse(routeParams.params ?? '');
    } catch {
      parsedParams = [];
    }
    return {
      id: Number(routeParams.id),
      method: routeParams.method,
      from: routeParams.from,
      params: parsedParams,
    };
  }, [routeParams]);

  useEffect(() => {
    const initializeAction = async () => {
      if (!method) {
        throw new Error('Method is required');
      }

      // Handle auto-approval for whitelisted dapps
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
        const whitelist = await BackgroundExecutor.getWhitelist();
        if (whitelist.includes(from)) {
          // Auto-approve whitelisted dapps
          const addressResponse = await BackgroundExecutor.getAddress(network, accountNumber);
          await BackgroundExecutor.whitelistDapp(from);
          BrowserBridge.instance?.sendMessage({ for: 'webpage', id, response: [addressResponse] });
          router.back();
          return;
        }
      }
    };

    initializeAction();
  }, [network, accountNumber, method, from, id, router]);

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
          <View style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>Unknown method: {method}</ThemedText>
          </View>
        );
    }
  };

  return <View style={styles.container}>{renderMethodComponent()}</View>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  errorText: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
});

export default Action;
