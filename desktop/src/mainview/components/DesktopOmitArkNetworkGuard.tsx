import { useContext, useEffect } from 'react';

import { DEFAULT_NETWORK } from '@shared/config';
import { NetworkContext } from '@shared/hooks/NetworkContext';

import { isDesktopOmittedNetwork } from '../utils/desktop-networks';

/** If storage still has an Ark network selected, move to a supported desktop network. */
export function DesktopOmitArkNetworkGuard() {
  const { network, setNetwork } = useContext(NetworkContext);

  useEffect(() => {
    if (isDesktopOmittedNetwork(network)) {
      setNetwork(DEFAULT_NETWORK);
    }
  }, [network, setNetwork]);

  return null;
}
