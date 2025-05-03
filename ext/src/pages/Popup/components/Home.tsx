import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_NETWORK } from '@shared/config';
import { getDecimalsByNetwork, getIsTestnet, getTickerByNetwork } from '@shared/models/network-getters';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useBalance } from '@shared/hooks/useBalance';
import { BackgroundCaller } from '../../../modules/background-caller';
import { Button } from '../DesignSystem';
import { NETWORK_ARKMUTINYNET, NETWORK_BITCOIN, NETWORK_LIQUIDTESTNET, Networks } from '@shared/types/networks';
import TokensView from './TokensView';
import PartnersView from './PartnersView';
import { formatBalance } from '@shared/modules/string-utils';
import { useExchangeRate } from '@shared/hooks/useExchangeRate';
import { NetworkSelector } from './NetworkSelector';
import { getCurrentTheme, LayerzColors } from '../theme';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { accountNumber } = useContext(AccountNumberContext);
  const { network, setNetwork } = useContext(NetworkContext);
  const { balance } = useBalance(network || DEFAULT_NETWORK, accountNumber, BackgroundCaller);
  const { exchangeRate } = useExchangeRate(network || DEFAULT_NETWORK, BackgroundCaller);
  const theme = getCurrentTheme();

  const handleSend = () => {
    switch (network) {
      case NETWORK_BITCOIN:
        navigate('/send-btc');
        break;
      case NETWORK_ARKMUTINYNET:
        navigate('/send-ark');
        break;
      case NETWORK_LIQUIDTESTNET:
        navigate('/send-liquid');
        break;
      default:
        navigate('/send-evm');
    }
  };

  return (
    <div
      style={{
        padding: '20px',
        backgroundColor: LayerzColors[theme].background,
        height: '100%',
        maxHeight: '100vh',
        overflow: 'auto',
      }}
    >
      <h1>
        {getIsTestnet(network) ? <div style={{ fontSize: 10, color: LayerzColors[theme].error, fontWeight: 'bold' }}>{network.toUpperCase()}: THIS IS A TESTNET. COINS HAVE NO VALUE.</div> : null}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <NetworkSelector selectedNetwork={network} onNetworkChange={(network) => setNetwork(network as Networks)} filterLiquid={false} />

          <div style={{ fontSize: 24, fontWeight: 'bold', textAlign: 'center' }}>
            {formatBalance(balance, getDecimalsByNetwork(network), 8)} {getTickerByNetwork(network)}
          </div>

          <span style={{ fontSize: 14 }}>{balance && +balance > 0 && exchangeRate ? '$' + (+formatBalance(balance, getDecimalsByNetwork(network), 8) * exchangeRate).toPrecision(2) : ''}</span>
        </div>
      </h1>

      <PartnersView />
      <TokensView />

      <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
        <Button
          variant="receive"
          size="large"
          onClick={() => navigate('/receive')}
          data-testid="ReceiveButton"
          style={{
            width: '100%',
            fontWeight: 600,
          }}
        >
          <ArrowDownIcon size={22} />
          Receive
        </Button>

        <Button
          variant="send"
          size="large"
          onClick={handleSend}
          data-testid="SendButton"
          style={{
            width: '100%',
            fontWeight: 600,
          }}
        >
          <ArrowUpIcon size={22} />
          Send
        </Button>
      </div>
    </div>
  );
};

export default Home;
