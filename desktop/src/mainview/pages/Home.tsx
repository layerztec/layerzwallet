import { ArrowDownLeft, ArrowUpRight, ChevronDown, Settings } from 'lucide-react';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { ensureMcpBootstrapped, isMcpActivated } from '../features/mcp/tunnel-desktop';

import { accountItems, AccountNumberContext, getAccountItem, MCP_BALANCE_ACCOUNT_NUMBER } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useAvailableNetworks } from '@shared/hooks/useAvailableNetworks';
import { NETWORK_ARK, NETWORK_ARK_MUTINYNET, NETWORK_SPARK, NETWORK_STACKS } from '@shared/types/networks';
import { getIsEVM } from '@shared/models/network-getters';
import { capitalizeFirstLetter } from '@shared/modules/string-utils';
import { getNetworkPrimaryColor } from '@shared/constants/Colors';

import { DropdownSelect } from '../components/DropdownSelect';
import { NetworkDropdownLabel } from '../components/NetworkDropdownLabel';
import { AccountPocketIcon, AccountPocketOptionLabel } from '../components/home/AccountPocketIcon';
import { HomeActionButton } from '../components/home/HomeActionButton';
import { HomeBalance } from '../components/home/HomeBalance';
import { NftsView } from '../components/home/NftsView';
import { TokensView } from '../components/home/TokensView';
import { McpAgentActivateModal } from '../components/mcp/McpAgentActivateModal';
import { McpAgentDashboard } from '../components/mcp/McpAgentDashboard';
import { McpTunnelStatusRow } from '../components/mcp/McpTunnelStatusRow';
import { RadialGradientScreen } from '../components/home/RadialGradientScreen';
import { getNetworkImageUrl } from '../utils/network-assets';
import './Home.css';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { network, setNetwork } = useContext(NetworkContext);
  const { accountNumber, setAccountNumber } = useContext(AccountNumberContext);
  const availableNetworks = useAvailableNetworks();
  const networkIconUrl = getNetworkImageUrl(network);
  const accountItem = getAccountItem(accountNumber);
  const accountLabel = accountItem.name.length > 10 ? `${accountItem.name.substring(0, 10)}…` : accountItem.name;
  const networkLabel = capitalizeFirstLetter(network);
  const networkAccentColor = getNetworkPrimaryColor(network);

  // Send is implemented for single-address (account-based) wallets via SendAccountBased and for EVM wallets via SendEvm.
  const isAccountBasedNetwork = network === NETWORK_ARK || network === NETWORK_ARK_MUTINYNET || network === NETWORK_SPARK || network === NETWORK_STACKS;
  const isEvmNetwork = getIsEVM(network);
  const isSendSupported = isAccountBasedNetwork || isEvmNetwork;

  const [showActivateModal, setShowActivateModal] = useState(false);
  const activateDismissedRef = useRef(false);

  useEffect(() => {
    if (accountNumber !== MCP_BALANCE_ACCOUNT_NUMBER) {
      activateDismissedRef.current = false;
      setShowActivateModal(false);
      return;
    }
    if (activateDismissedRef.current) return;

    let cancelled = false;
    void (async () => {
      await ensureMcpBootstrapped();
      if (cancelled) return;
      const activated = await isMcpActivated();
      if (cancelled || activated) return;
      setShowActivateModal(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [accountNumber]);

  const dismissActivateModal = () => {
    activateDismissedRef.current = true;
    setShowActivateModal(false);
  };

  const handleReceive = () => {
    navigate('/receive');
  };

  const handleSend = () => {
    navigate(isEvmNetwork ? '/send-evm' : '/send');
  };

  return (
    <RadialGradientScreen network={network} className="home-screen">
      <header className="home-header">
        <DropdownSelect
          className="home-pocket"
          testId="pocket-switcher"
          triggerTestId="account-select"
          value={accountNumber}
          options={accountItems.map((item) => ({
            value: item.accountNumber,
            label: <AccountPocketOptionLabel item={item} />,
          }))}
          onChange={setAccountNumber}
          ariaLabel="Switch pocket"
          menuAccentColor={networkAccentColor}
          renderTrigger={() => (
            <>
              <AccountPocketIcon item={accountItem} variant="header" />
              <span className="home-pocket-label">{accountLabel}</span>
              <ChevronDown size={16} color="rgba(255, 255, 255, 0.8)" aria-hidden />
            </>
          )}
        />

        <button type="button" className="home-icon-button" onClick={() => navigate('/settings')} aria-label="Settings" data-testid="settings-button">
          <Settings size={24} />
        </button>
      </header>

      <div className="home-scroll">
        <DropdownSelect
          className="home-pill home-network-pill"
          testId={`selectedNetwork-${network}`}
          triggerTestId="NetworkSwitcherTrigger"
          value={network}
          options={availableNetworks.map((n) => ({
            value: n,
            label: <NetworkDropdownLabel network={n} />,
            testId: `network-option-${n}`,
          }))}
          onChange={setNetwork}
          ariaLabel="Switch network"
          menuAccentColor={networkAccentColor}
          renderTrigger={() => (
            <>
              <span className="home-network-icon" aria-hidden>
                {networkIconUrl ? <img src={networkIconUrl} alt="" /> : null}
              </span>
              <span className="home-network-name">{networkLabel}</span>
              <span className="home-pill-chevron" aria-hidden />
            </>
          )}
        />

        <HomeBalance />

        {accountNumber === MCP_BALANCE_ACCOUNT_NUMBER ? <McpTunnelStatusRow /> : null}
        {accountNumber === MCP_BALANCE_ACCOUNT_NUMBER ? <McpAgentDashboard /> : null}

        {accountNumber !== MCP_BALANCE_ACCOUNT_NUMBER ? (
          <div className="home-actions">
            <HomeActionButton title="Receive" icon={ArrowDownLeft} onClick={handleReceive} testId="ReceiveButton" />
            {isSendSupported ? <HomeActionButton title="Send" icon={ArrowUpRight} onClick={handleSend} testId="SendButton" /> : null}
          </div>
        ) : null}

        <TokensView />
        <NftsView />
      </div>

      {showActivateModal ? <McpAgentActivateModal onClose={dismissActivateModal} /> : null}
    </RadialGradientScreen>
  );
};

export default Home;
