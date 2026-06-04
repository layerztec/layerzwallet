import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router';

import { NetworkContext } from '@shared/hooks/NetworkContext';
import { RadialGradientScreen } from '../components/home/RadialGradientScreen';
import { ThemedText } from '../components/ThemedText';
import { resetAppState } from '../modules/reset-app-state';
import { WalletToolButton } from '../components/home/WalletToolButton';
import './Home.css';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { network } = useContext(NetworkContext);
  const [isResetting, setIsResetting] = useState(false);
  const handleClearStorage = async () => {
    if (!window.confirm('Clear all wallet data and return to onboarding?\n\nThis removes your mnemonic, settings, and cached balances from this device. This cannot be undone.')) {
      return;
    }

    setIsResetting(true);
    try {
      await resetAppState();
    } catch (err) {
      console.error('Failed to reset app state:', err);
      setIsResetting(false);
      alert('Failed to clear storage. See console for details.');
    }
  };

  return (
    <RadialGradientScreen network={network} className="home-screen">
      <div className="home-subpage-shell">
        <ThemedText type="headline" style={{ color: '#fff', marginBottom: 16 }}>
          Settings
        </ThemedText>

        <div className="wallet-tool-button-group">
          <WalletToolButton block onClick={() => navigate('/home')} data-testid="settings-back-button">
            Back
          </WalletToolButton>
          <WalletToolButton block onClick={handleClearStorage} disabled={isResetting} data-testid="clear-storage-button">
            {isResetting ? 'Clearing…' : 'Clear storage'}
          </WalletToolButton>
        </div>
      </div>
    </RadialGradientScreen>
  );
};

export default SettingsPage;
