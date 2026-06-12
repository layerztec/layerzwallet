import { Lock } from 'lucide-react';
import React, { useContext, useMemo } from 'react';
import { useNavigate } from 'react-router';

import type { ReceiveTokenProps } from '../../pages/Receive';
import { ActionPopupAction } from '../ActionPopupAction';
import { ActionPopupButton } from '../ActionPopupButton';
import { WalletToolButton } from '../home/WalletToolButton';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useAccountBalance } from '@shared/hooks/useAccountBalance';
import { useAvailableNetworks } from '../../hooks/useAvailableNetworks';
import { useExchangeRate } from '@shared/hooks/useExchangeRate';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { formatBalance, formatFiatBalance } from '@shared/modules/string-utils';
import { NETWORK_BITCOIN, NETWORK_LIGHTNING, NETWORK_LIGHTNING_TESTNET, NETWORK_LIQUID, NETWORK_ROOTSTOCK, NETWORK_SPARK, NETWORK_USDT } from '@shared/types/networks';

import './McpAgentDashboard.css';

const noop = () => {};

/** Desktop port of mobile `McpAgentDashboard`. */
export const McpAgentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const availableNetworks = useAvailableNetworks();
  const { accountBalance } = useAccountBalance(accountNumber, availableNetworks);
  const { exchangeRate } = useExchangeRate(NETWORK_BITCOIN, 'USD');

  const [budgetFiat, budgetSats] = useMemo<[string, string]>(() => {
    const decimals = getDecimalsByNetwork(NETWORK_BITCOIN);
    if (!accountBalance) return ['—', '— sats'];
    const nativeBtc = `${formatBalance(accountBalance, decimals, 8)} ${getTickerByNetwork(NETWORK_BITCOIN)}`;
    if (!exchangeRate) return ['—', nativeBtc];
    return [`$${formatFiatBalance(accountBalance, decimals, exchangeRate)}`, nativeBtc];
  }, [accountBalance, exchangeRate]);

  const handleAddFunds = () => {
    navigate('/receive');
  };

  const handleReceiveOnLightningAddress = () => {
    navigate('/receive-on-lightning-address');
  };

  const handleReceiveTokenViaRootstock = () => {
    const params: ReceiveTokenProps = { network: NETWORK_ROOTSTOCK };
    navigate(`/receive?network=${params.network}`);
  };

  const handleReceiveTokenViaLiquid = () => {
    const params: ReceiveTokenProps = { network: NETWORK_LIQUID };
    navigate(`/receive?network=${params.network}`);
  };

  const handleReceiveTokenViaSpark = () => {
    const params: ReceiveTokenProps = { network: NETWORK_SPARK };
    navigate(`/receive?network=${params.network}`);
  };

  const usdtReceiveActions = [
    {
      children: <ActionPopupAction network={NETWORK_ROOTSTOCK} text="Receive via Rootstock" />,
      onClick: handleReceiveTokenViaRootstock,
    },
    {
      children: <ActionPopupAction network={NETWORK_LIQUID} text="Receive via Liquid" />,
      onClick: handleReceiveTokenViaLiquid,
    },
    {
      children: <ActionPopupAction network={NETWORK_SPARK} text="Receive via Spark" />,
      onClick: handleReceiveTokenViaSpark,
    },
    { children: <ActionPopupAction text="Cancel" />, onClick: noop },
  ];

  const addFundsButton = (
    <WalletToolButton onClick={network === NETWORK_LIGHTNING || network === NETWORK_LIGHTNING_TESTNET ? handleReceiveOnLightningAddress : handleAddFunds} aria-label="Add funds">
      Add funds
    </WalletToolButton>
  );

  return (
    <section className="mcp-dashboard-section" aria-label="AI agent dashboard">
      <div className="mcp-dashboard-grid">
        <div className="mcp-dashboard-tools-card">
          <p className="mcp-dashboard-card-title">Tools</p>
          <div className="mcp-dashboard-tool-buttons">
            {network === NETWORK_USDT ? (
              <ActionPopupButton actions={usdtReceiveActions} title="Layer to receive">
                {addFundsButton}
              </ActionPopupButton>
            ) : (
              addFundsButton
            )}
          </div>
        </div>

        <div className="mcp-dashboard-right-column">
          <button type="button" className="mcp-dashboard-budget-card" onClick={noop} aria-label="Budget">
            <p className="mcp-dashboard-card-title">Budget</p>
            <p className="mcp-dashboard-budget-amount">{budgetFiat}</p>
            <p className="mcp-dashboard-budget-sats">{budgetSats}</p>
            <div className="mcp-dashboard-budget-divider" aria-hidden />
            <div className="mcp-dashboard-spent-row">
              <span className="mcp-dashboard-spent-label">Spent</span>
              <span className="mcp-dashboard-spent-value">$0</span>
            </div>
          </button>

          <button type="button" className="mcp-dashboard-permissions-card" onClick={() => navigate('/mcp-permissions-modal')} aria-label="Permissions">
            <div className="mcp-dashboard-lock-icon" aria-hidden>
              <Lock size={15} strokeWidth={2.5} />
            </div>
            <div className="mcp-dashboard-permissions-text">
              <p className="mcp-dashboard-permissions-title">Permissions</p>
              <p className="mcp-dashboard-permissions-subtitle">6 out of 6</p>
            </div>
          </button>
        </div>
      </div>
    </section>
  );
};
