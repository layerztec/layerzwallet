import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_NETWORK } from '@shared/config';
import { getDecimalsByNetwork, getIsTestnet, getTickerByNetwork } from '@shared/models/network-getters';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useBalance } from '@shared/hooks/useBalance';
import { BackgroundCaller } from '../../../modules/background-caller';
import { Button, Container, Text } from '../../../../shared/ui';
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
    <>
      <div
        style={{
          padding: '20px 20px 0 20px',
          background: '#f8f9fa',
          marginTop: 8,
          marginBottom: 8,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 32, color: '#393e42', lineHeight: 1.1 }}>LZ Bitcoin Wallet</span>
          <Button onClick={() => navigate('/settings')} style={{ background: 'none', boxShadow: 'none', padding: 0, minWidth: 0, minHeight: 0 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#393e42" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 16 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 8c.36.34.87.5 1.37.41.5-.09.97-.41 1.23-.91.26-.5.26-1.09 0-1.59-.26-.5-.73-.82-1.23-.91-.5-.09-1.01.07-1.37.41z" />
            </svg>
          </Button>
        </div>
        <span style={{ fontSize: 18, color: '#888', fontWeight: 500, marginBottom: 12 }}>Developer preview release {require('@shared/class/hello').Hello.world()}</span>
      </div>
      <Container
        style={{
          padding: '20px',
          paddingTop: 32,
          paddingBottom: 32,
          backgroundColor: LayerzColors[theme].background,
          height: '600px', // Fixed height for popup
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <h1>
          {getIsTestnet(network) ? (
            <div
              style={{
                backgroundColor: 'rgba(255, 0, 0, 0.1)',
                padding: 10,
                borderRadius: 5,
                margin: '20px 20px 10px 20px',
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  color: LayerzColors[theme].error,
                  fontSize: 10,
                  textAlign: 'center',
                  fontWeight: 'bold',
                  display: 'block',
                }}
              >
                Warning: You are using a testnet, coins have no value
              </span>
            </div>
          ) : null}

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
      </Container>
    </>
  );
};

export default Home;
