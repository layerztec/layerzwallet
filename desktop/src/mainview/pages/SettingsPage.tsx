import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router';

import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { EStep, InitializationContext } from '@shared/hooks/InitializationContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { RadialGradientScreen } from '../components/home/RadialGradientScreen';
import { ThemedText } from '../components/ThemedText';
import { showDesktopNotification } from '../modules/notifications';
import { resetAppState } from '../modules/reset-app-state';
import { runSelfDiagnostics, type DiagnosticResult } from '../modules/self-diagnostics';
import { WalletToolButton } from '../components/home/WalletToolButton';
import './Home.css';
import './SettingsPage.css';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { network } = useContext(NetworkContext);
  const { setStep } = useContext(InitializationContext);
  const { setAccountNumber } = useContext(AccountNumberContext);
  const [isResetting, setIsResetting] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[] | null>(null);

  const allPassed = results !== null && results.every((r) => r.ok);
  const overallStatus = results === null ? null : allPassed ? 'OK' : 'FAILED';

  const handleRunDiagnostics = async () => {
    setIsDiagnosing(true);
    setResults(null);
    try {
      setResults(await runSelfDiagnostics());
    } catch (err) {
      console.error('Self-diagnostics crashed:', err);
      setResults([{ name: 'Self-diagnostics runner', ok: false, detail: err instanceof Error ? err.message : String(err) }]);
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleTestNotification = async () => {
    await showDesktopNotification({
      title: 'Layerz Wallet',
      subtitle: 'Test notification',
      body: 'If you can see this, native OS notifications are working.',
    });
  };

  const handleClearStorage = async () => {
    if (!window.confirm('Clear all wallet data and return to onboarding?\n\nThis removes your mnemonic, settings, and cached balances from this device. This cannot be undone.')) {
      return;
    }

    setIsResetting(true);
    try {
      await resetAppState();
      setAccountNumber(-1);
      navigate('/');
      setStep(EStep.INTRO);
    } catch (err) {
      console.error('Failed to reset app state:', err);
      alert('Failed to clear storage. See console for details.');
    } finally {
      setIsResetting(false);
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
          <WalletToolButton block onClick={handleRunDiagnostics} disabled={isDiagnosing} data-testid="run-diagnostics-button">
            {isDiagnosing ? 'Running self-test…' : 'Run self-test'}
          </WalletToolButton>
          <WalletToolButton block onClick={handleTestNotification} data-testid="test-notification-button">
            Send test notification
          </WalletToolButton>
          <WalletToolButton block onClick={handleClearStorage} disabled={isResetting} data-testid="clear-storage-button">
            {isResetting ? 'Clearing…' : 'Clear storage'}
          </WalletToolButton>
        </div>

        {(isDiagnosing || results !== null) && (
          <div className="diagnostics" data-testid="messages">
            {overallStatus !== null && (
              <div className={`diagnostics-status diagnostics-status--${allPassed ? 'ok' : 'fail'}`} data-testid="diagnostics-status">
                {allPassed ? '✓ All checks passed — OK' : '✗ Some checks failed — FAILED'}
              </div>
            )}
            {results === null && isDiagnosing && <div className="diagnostics-row diagnostics-row--pending">Running…</div>}
            {results?.map((result, index) => (
              <div key={result.name} className={`diagnostics-row diagnostics-row--${result.ok ? 'ok' : 'fail'}`} data-testid={`diagnostic-row-${index}`}>
                <span className="diagnostics-row-icon">{result.ok ? '✓' : '✗'}</span>
                <span className="diagnostics-row-name">{result.name}</span>
                <span className="diagnostics-row-detail">{result.detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </RadialGradientScreen>
  );
};

export default SettingsPage;
