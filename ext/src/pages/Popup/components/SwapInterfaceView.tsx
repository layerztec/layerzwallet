import assert from 'assert';
import BigNumber from 'bignumber.js';
import { Loader2 } from 'lucide-react';
import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useSwapBalance } from '@shared/hooks/useSwapBalance';
import { getSwapPairs, getSwapProvidersList, getSwapTargetName } from '@shared/models/swap-providers-list';
import { NETWORK_LIQUID, NETWORK_STACKS, Networks } from '@shared/types/networks';
import { SwapPair, SwapPlatform, SwapOptions, SO_LIQUID_USDT, SO_ROOTSTOCK_USDT, SO_STACKS_STX } from '@shared/types/swap';
import { BackgroundCaller } from '../../../modules/background-caller';
import { Button, Input } from '../DesignSystem';

interface SwapInterfaceViewProps {
  fromNetwork: SwapOptions;
}

const SwapInterfaceView: React.FC<SwapInterfaceViewProps> = ({ fromNetwork }) => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState<string>('');
  const [targetNetwork, setTargetNetwork] = useState<SwapOptions>();
  const { network, setNetwork } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);

  // Use appropriate balance hook for the fromNetwork
  const { balance, decimals, ticker } = useSwapBalance(network, fromNetwork, BackgroundCaller);

  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [swapPairs, setSwapPairs] = useState<SwapPair[]>([]);

  useEffect(() => {
    setSwapPairs(getSwapPairs(fromNetwork, SwapPlatform.EXT));
    setTargetNetwork(undefined); // Reset target when from network changes
  }, [fromNetwork]);

  const handleSwap = async (): Promise<void> => {
    setError('');
    assert(balance, 'internal error: balance not loaded');
    assert(targetNetwork, 'internal error: target network not selected');
    const amt = parseFloat(amount);
    assert(!isNaN(amt), 'Invalid amount');
    assert(amt > 0, 'Amount should be > 0');
    const satValueBN = new BigNumber(amt);
    const satValue = satValueBN.multipliedBy(new BigNumber(10).pow(decimals)).toString(10);
    assert(new BigNumber(balance).gte(satValue), 'Not enough balance');

    const swapProviders = getSwapProvidersList(fromNetwork);
    const provider = swapProviders.find((p) =>
      p.getSupportedPairs().some((pair) => pair.from === fromNetwork && pair.to === targetNetwork && (pair.platform === SwapPlatform.EXT || pair.platform === SwapPlatform.ALL))
    );

    assert(provider, 'No provider found for the selected networks');

    if (!amount || isNaN(parseFloat(amount))) {
      throw new Error('Invalid amount');
    }

    let destinationAddress = '';
    if (targetNetwork === SO_LIQUID_USDT || targetNetwork === SO_ROOTSTOCK_USDT) {
      destinationAddress = await BackgroundCaller.getAddress(NETWORK_LIQUID, accountNumber);
    } else if (targetNetwork === SO_STACKS_STX) {
      destinationAddress = await BackgroundCaller.getAddress(NETWORK_STACKS, accountNumber);
    } else {
      destinationAddress = await BackgroundCaller.getAddress(targetNetwork as Networks, accountNumber);
    }

    assert(destinationAddress, 'internal error: no destination address');

    const swapResponse = await provider.swap(fromNetwork, setNetwork, targetNetwork, parseInt(satValue), destinationAddress);

    switch (swapResponse.action) {
      case 'DAPP_BROWSER':
      case 'EXTERNAL_BROWSER':
        window.open(swapResponse.uri, '_blank');
        return;
      case 'INTERNAL_SCREEN':
        navigate('/SwapXArkDeposit', { state: swapResponse.params });
        return;
      default:
        throw new Error('Unhandled swap action');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <span>Swap</span>
        <Input type="number" data-testid="swap-amount-input" style={{ width: '25%' }} placeholder="0.000" onChange={(event) => setAmount(event.target.value)} value={amount} />
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: '0.8em' }}>
            <b>{ticker}</b>
          </span>
        </div>

        <span>to</span>

        <div style={{ flex: 1 }}>
          <select
            value={targetNetwork}
            onChange={(e) => setTargetNetwork(e.target.value as SwapOptions)}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ccc',
            }}
          >
            <option value="">Select target network</option>
            {swapPairs
              .map((pair) => pair.to)
              .map((target) => (
                <option key={`to-${target}`} value={target}>
                  {getSwapTargetName(target)}
                </option>
              ))}
          </select>
        </div>

        {targetNetwork && !isLoading && (
          <Button
            onClick={() => {
              setIsLoading(true);
              handleSwap()
                .catch((e) => setError(e.message))
                .finally(() => setIsLoading(false));
            }}
          >
            Go
          </Button>
        )}

        {isLoading && <Loader2 className="animate-spin" size={24} />}
      </div>

      {error && <div style={{ color: 'red' }}>{error}</div>}
    </div>
  );
};

export default SwapInterfaceView;
