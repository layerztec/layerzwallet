import { Loader2 } from 'lucide-react';
import React, { useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import BigNumber from 'bignumber.js';
import assert from 'assert';

import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { NETWORK_ARK, NETWORK_ARK_MUTINYNET, NETWORK_SPARK } from '@shared/types/networks';
import { getDecimalsByNetwork } from '@shared/models/network-getters';
import { SparkWallet } from '@shared/class/wallets/spark-wallet';
import { ArkWallet } from '@shared/class/wallets/ark-wallet';

import { BackgroundCaller } from '../../modules/background-caller';

export type SwapXArkDepositParams = {
  amountIn: string;
  to: typeof NETWORK_ARK | typeof NETWORK_ARK_MUTINYNET | typeof NETWORK_SPARK;
};

export default function SwapXArkDeposit() {
  const navigate = useNavigate();
  const location = useLocation();
  const network = useContext(NetworkContext).network as typeof NETWORK_ARK | typeof NETWORK_ARK_MUTINYNET | typeof NETWORK_SPARK;
  const { accountNumber } = useContext(AccountNumberContext);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const params = location.state as SwapXArkDepositParams;
  const { amountIn, to } = params;

  // get the Spark deposit address and redirect to SendBtc
  useEffect(() => {
    const redirect = async () => {
      try {
        const wallet = await BackgroundCaller.lazyInitWallet(to, accountNumber);
        assert(wallet instanceof SparkWallet || wallet instanceof ArkWallet, 'Not a XArk wallet');
        const toAddress = await wallet.getOnchainDepositAddress();
        const amount = new BigNumber(amountIn).dividedBy(10 ** getDecimalsByNetwork(network)).toString(10);

        navigate('/send-btc', {
          state: {
            toAddress,
            amount,
            xArkSwapTo: to,
          },
        });
      } catch (error: any) {
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };
    redirect();
  }, [navigate, amountIn, accountNumber, network, to]);

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2>{to === NETWORK_SPARK ? 'Spark' : 'Ark'} Swap</h2>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <Loader2 className="animate-spin" size={24} />
          <span style={{ marginLeft: '10px' }}>Preparing swap...</span>
        </div>
      )}

      {error && <div style={{ color: 'red', padding: '10px', backgroundColor: '#ffe6e6', borderRadius: '4px' }}>{error}</div>}
    </div>
  );
}
