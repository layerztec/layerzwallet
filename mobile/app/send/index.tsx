import { Redirect, useLocalSearchParams } from 'expo-router';
import React, { useContext, useLayoutEffect } from 'react';

import { NetworkContext } from '@shared/hooks/NetworkContext';
import { NETWORK_LIGHTNING, NETWORK_LIGHTNING_TESTNET } from '@shared/types/networks';
import { useSendFlow } from './_layout';

export type SendParams = {
  address?: string;
  amount?: string;
  token?: string;
  network?: string;
};

const SendIndex: React.FC = () => {
  const params = useLocalSearchParams<SendParams>();
  const { setAddress, setAmount, setToken } = useSendFlow();
  const { network, setNetwork } = useContext(NetworkContext);

  // Set params in context if provided
  useLayoutEffect(() => {
    if (params.address) {
      setAddress(params.address);
    }
    if (params.amount) {
      setAmount(params.amount);
    }
    if (params.token) {
      setToken(params.token);
    }
    if (params.network) {
      setNetwork(params.network as any);
    }
  }, [params.address, params.amount, params.token, params.network, setAddress, setAmount, setToken, setNetwork]);

  // Route to lightning address screen for lightning networks
  if (network === NETWORK_LIGHTNING || network === NETWORK_LIGHTNING_TESTNET) {
    return <Redirect href="/send/send-address-lightning" />;
  }

  return <Redirect href="/send/send-address" />;
};

export default SendIndex;
