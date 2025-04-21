import { Hello } from '@shared/class/hello';
import { AccountNumberContextProvider } from '@shared/hooks/AccountNumberContext';
import { EStep, InitializationContext, InitializationContextProvider } from '@shared/hooks/InitializationContext';
import { NetworkContextProvider } from '@shared/hooks/NetworkContext';
import { SettingsIcon } from 'lucide-react';
import React, { useCallback, useContext } from 'react';
import { Navigate, Route, HashRouter as Router, Routes, useNavigate } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { LayerzStorage } from '../../class/layerz-storage';
import { SwrCacheProvider } from '../../class/swr-cache-provider';
import { AskPasswordContextProvider } from '../../hooks/AskPasswordContext';
import { ScanQrContextProvider } from '../../hooks/ScanQrContext';
import { BackgroundCaller } from '../../modules/background-caller';
import Action from './Action';
import Home from './components/Home';
import { Card } from './DesignSystem';
import OnboardingCreatePassword from './OnboardingCreatePassword';
import OnboardingCreateWallet from './OnboardingCreateWallet';
import OnboardingImportWallet from './OnboardingImportWallet';
import OnboardingIntro from './OnboardingIntro';
import OnboardingTos from './OnboardingTos';
import './Popup.css';
import Receive from './Receive';
import SendArk from './SendArk';
import SendBtc from './SendBtc';
import SendEvm from './SendEvm';
import SendLiquid from './SendLiquid';
import SendTokenEvm from './SendTokenEvm';
import SettingsPage from './SettingsPage';
import TestPage from './TestPage';
import TransactionSuccessEvm from './TransactionSuccessEvm';

const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const { step } = useContext(InitializationContext);

  const Content: React.FC = useCallback(() => {
    switch (step) {
      case EStep.INTRO:
        return (
          <Routes>
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/onboarding-intro" element={<OnboardingIntro />} />
            <Route path="/onboarding-create-wallet" element={<OnboardingCreateWallet />} />
            <Route path="/onboarding-import-wallet" element={<OnboardingImportWallet />} />
            <Route path="*" element={<Navigate to="/onboarding-intro" replace />} />
          </Routes>
        );

      case EStep.PASSWORD:
        return (
          <Routes>
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/onboarding-create-password" element={<OnboardingCreatePassword />} />
            <Route path="*" element={<Navigate to="/onboarding-create-password" replace />} />
          </Routes>
        );

      case EStep.TOS:
        return (
          <Routes>
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/onboarding-tos" element={<OnboardingTos />} />
            <Route path="*" element={<Navigate to="/onboarding-tos" replace />} />
          </Routes>
        );

      case EStep.READY:
        return (
          <Routes>
            <Route path="/test" element={<TestPage />} />
            <Route path="/home" element={<Home />} />
            <Route path="/receive" element={<Receive />} />
            <Route path="/send-evm" element={<SendEvm />} />
            <Route path="/send-ark" element={<SendArk />} />
            <Route path="/send-token-evm" element={<SendTokenEvm />} />
            <Route path="/send-btc" element={<SendBtc />} />
            <Route path="/send-liquid" element={<SendLiquid />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/transaction-success" element={<TransactionSuccessEvm />} />
            <Route path="/action" element={<Action />} />
            <Route path="/" element={<Navigate to="/home" replace />} />
          </Routes>
        );
    }
  }, [step]);

  return (
    <div className="App">
      <header className="App-header">
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 onClick={() => navigate('/')} style={{ margin: 0, cursor: 'pointer' }}>
            LZ Bitcoin Wallet
          </h1>
          <SettingsIcon onClick={() => navigate('/settings')} data-testid="settings-button" />
        </div>
        <div style={{ color: 'gray', textAlign: 'left', width: '100%', marginBottom: '15px' }}>
          <b style={{ fontSize: 18 }}>Developer preview release {Hello.world()}</b>
        </div>
        <Card>
          <Content />
        </Card>
      </header>
    </div>
  );
};

const Popup: React.FC = () => {
  return (
    <Router>
      <SWRConfig value={{ provider: () => new SwrCacheProvider() }}>
        <AskPasswordContextProvider>
          <ScanQrContextProvider>
            <InitializationContextProvider storage={LayerzStorage} backgroundCaller={BackgroundCaller}>
              <AccountNumberContextProvider storage={LayerzStorage} backgroundCaller={BackgroundCaller}>
                <NetworkContextProvider storage={LayerzStorage} backgroundCaller={BackgroundCaller}>
                  <AppContent />
                </NetworkContextProvider>
              </AccountNumberContextProvider>
            </InitializationContextProvider>
          </ScanQrContextProvider>
        </AskPasswordContextProvider>
      </SWRConfig>
    </Router>
  );
};

export default Popup;
