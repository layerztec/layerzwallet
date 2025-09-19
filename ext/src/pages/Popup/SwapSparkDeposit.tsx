import { Loader2 } from 'lucide-react';
import React, { useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import BigNumber from 'bignumber.js';
import assert from 'assert';

import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { NETWORK_SPARK } from '@shared/types/networks';
import { getDecimalsByNetwork } from '@shared/models/network-getters';
import { SparkWallet } from '@shared/class/wallets/spark-wallet';

import { BackgroundCaller } from '../../modules/background-caller';

export interface SwapSparkDepositParams {
  amountIn: string;
}

const SwapSparkDeposit: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const params = location.state as SwapSparkDepositParams;

  useEffect(() => {
    const redirect = async () => {
      try {
        const wallet = await BackgroundCaller.lazyInitWallet(NETWORK_SPARK, accountNumber);
        assert(wallet instanceof SparkWallet);
        const toAddress = await wallet.getOnchainDepositAddress();
        const amount = new BigNumber(params.amountIn).dividedBy(10 ** getDecimalsByNetwork(network)).toString(10);

        navigate('/send-btc', {
          state: {
            toAddress,
            amount,
            sparkSwap: true,
          },
        });
      } catch (error: any) {
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };
    redirect();
  }, [navigate, params.amountIn, accountNumber, network]);

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2>Spark Swap</h2>
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
};

export default SwapSparkDeposit;
