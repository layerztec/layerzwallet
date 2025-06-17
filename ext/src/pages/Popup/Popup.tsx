import { SettingsIcon } from 'lucide-react';
import React, { useCallback, useContext } from 'react';
import { Navigate, Route, HashRouter as Router, Routes, useNavigate } from 'react-router';
import { SWRConfig } from 'swr';

import '../../modules/breeze-adapter'; // needed to be imported before we can use BreezWallet
import '../../modules/spark-adapter'; // needed to be imported before we can use SparkWallet

import { Hello } from '@shared/class/hello';
import { AccountNumberContextProvider } from '@shared/hooks/AccountNumberContext';
import { EStep, InitializationContext, InitializationContextProvider } from '@shared/hooks/InitializationContext';
import { NetworkContextProvider } from '@shared/hooks/NetworkContext';
import { LayerzStorage } from '../../class/layerz-storage';
import { SwrCacheProvider } from '../../class/swr-cache-provider';
import { AskPasswordContextProvider } from '../../hooks/AskPasswordContext';
import { AskMnemonicContextProvider } from '../../hooks/AskMnemonicContext';
import { ScanQrContextProvider } from '../../hooks/ScanQrContext';
import { BackgroundCaller } from '../../modules/background-caller';
import Action from './Action';
import { Card } from './DesignSystem';
import Home from './Home';
import OnboardingCreatePassword from './OnboardingCreatePassword';
import OnboardingCreateWallet from './OnboardingCreateWallet';
import OnboardingImportWallet from './OnboardingImportWallet';
import OnboardingIntro from './OnboardingIntro';
import OnboardingTos from './OnboardingTos';
import './Popup.css';
import Receive from './Receive';
import ReceiveBreez from './ReceiveBreez';
import ReceiveLightning from './ReceiveLightning';
import SendArk from './SendArk';
import SendBtc from './SendBtc';
import SendEvm from './SendEvm';
import SendLightning from './SendLightning';
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
            <Route path="/receive-liquid" element={<ReceiveBreez />} />
            <Route path="/receive-lightning" element={<ReceiveLightning />} />
            <Route path="/send-liquid" element={<SendLiquid />} />
            <Route path="/send-evm" element={<SendEvm />} />
            <Route path="/send-ark" element={<SendArk />} />
            <Route path="/send-token-evm" element={<SendTokenEvm />} />
            <Route path="/send-btc" element={<SendBtc />} />
            <Route path="/send-lightning" element={<SendLightning />} />
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
            {Hello.world()}
          </h1>
          <SettingsIcon onClick={() => navigate('/settings')} data-testid="settings-button" />
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
          <AskMnemonicContextProvider>
            <ScanQrContextProvider>
              <InitializationContextProvider storage={LayerzStorage} backgroundCaller={BackgroundCaller}>
                <AccountNumberContextProvider storage={LayerzStorage} backgroundCaller={BackgroundCaller}>
                  <NetworkContextProvider storage={LayerzStorage} backgroundCaller={BackgroundCaller}>
                    <AppContent />
                  </NetworkContextProvider>
                </AccountNumberContextProvider>
              </InitializationContextProvider>
            </ScanQrContextProvider>
          </AskMnemonicContextProvider>
        </AskPasswordContextProvider>
      </SWRConfig>
    </Router>
  );
};

export default Popup;
