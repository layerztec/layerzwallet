import { SettingsIcon } from 'lucide-react';
import React, { useCallback, useContext } from 'react';
import { Navigate, Route, HashRouter as Router, Routes, useNavigate } from 'react-router';
import { SWRConfig } from 'swr';

import '../../modules/breeze-adapter'; // needed to be imported before we can use BreezWallet
import '../../modules/error-handler';
import '../../modules/rgb-adapter'; // needed to be imported before we can use RgbWallet
import '../../modules/spark-adapter'; // needed to be imported before we can use SparkWallet

import { AccountNumberContextProvider } from '@shared/hooks/AccountNumberContext';
import { EStep, InitializationContext, InitializationContextProvider } from '@shared/hooks/InitializationContext';
import { NetworkContextProvider } from '@shared/hooks/NetworkContext';
import { SettingsContextProvider } from '@shared/hooks/SettingsContext';
import { LayerzStorage } from '../../class/layerz-storage';
import { SwrCacheProvider } from '../../class/swr-cache-provider';
import { AskPasswordContextProvider } from '../../hooks/AskPasswordContext';
import { AskMnemonicContextProvider } from '../../hooks/AskMnemonicContext';
import { ScanQrContextProvider } from '../../hooks/ScanQrContext';
import { BackgroundCaller } from '../../modules/background-caller';
import { Messenger } from '../../modules/messenger';
import Action from './Action';
import { Card } from './DesignSystem';
import Home from './Home';
import OnboardingCreatePassword from './OnboardingCreatePassword';
import OnboardingCreateWallet from './OnboardingCreateWallet';
import OnboardingImportWallet from './OnboardingImportWallet';
import OnboardingIntro from './OnboardingIntro';
import OnboardingTos from './OnboardingTos';
import OnboardingVerifyingRgbBackup from './OnboardingVerifyingRgbBackup';
import './Popup.css';
import Receive from './Receive';
import ReceiveLightning from './ReceiveLightning';
import ReceiveRgbToken from './ReceiveRgbToken';
import SeedBackup from './SeedBackup';
import SendAccountBased from './SendAccountBased';
import SendBtc from './SendBtc';
import SendEvm from './SendEvm';
import SendLightning from './SendLightning';
import SendLiquid from './SendLiquid';
import SendRgb from './SendRgb';
import SendTokenEvm from './SendTokenEvm';
import SettingsPage from './SettingsPage';
import SwapDetails from './SwapDetails';
import SwapXArkClaim from './SwapXArkClaim';
import SwapXArkDeposit from './SwapXArkDeposit';
import TestPage from './TestPage';
import TransactionSuccessEvm from './TransactionSuccessEvm';
import UnlockPassword from './UnlockPassword';
import SendTokenStacks from './SendTokenStacks';
import NftGallery from './NftGallery';
import Nft from './Nft';

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

      /* onboarding - demand creation of password */
      case EStep.PASSWORD:
        return (
          <Routes>
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/onboarding-create-password" element={<OnboardingCreatePassword />} />
            <Route path="/onboarding-verifying-rgb-backup" element={<OnboardingVerifyingRgbBackup />} />
            <Route path="*" element={<Navigate to="/onboarding-create-password" replace />} />
          </Routes>
        );

      /* not exactly onboarding, but demand password to decrypt mnemonic and have it in runtime */
      case EStep.UNLOCK_PASSWORD:
        return (
          <Routes>
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/unlock-password" element={<UnlockPassword />} />
            <Route path="*" element={<Navigate to="/unlock-password" replace />} />
          </Routes>
        );

      case EStep.TOS:
        return (
          <Routes>
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/onboarding-tos" element={<OnboardingTos />} />
            <Route path="/onboarding-verifying-rgb-backup" element={<OnboardingVerifyingRgbBackup />} />
            <Route path="*" element={<Navigate to="/onboarding-tos" replace />} />
          </Routes>
        );

      case EStep.READY:
        return (
          <Routes>
            <Route path="/test" element={<TestPage />} />
            <Route path="/home" element={<Home />} />
            <Route path="/receive" element={<Receive />} />
            <Route path="/receive-lightning" element={<ReceiveLightning />} />
            <Route path="/receive-rgb-token" element={<ReceiveRgbToken />} />
            <Route path="/seed-backup" element={<SeedBackup />} />
            <Route path="/send-liquid" element={<SendLiquid />} />
            <Route path="/send-evm" element={<SendEvm />} />
            <Route path="/send-account-based" element={<SendAccountBased />} />
            <Route path="/send-token-evm" element={<SendTokenEvm />} />
            <Route path="/send-token-stacks" element={<SendTokenStacks />} />
            <Route path="/send-btc" element={<SendBtc />} />
            <Route path="/send-rgb" element={<SendRgb />} />
            <Route path="/send-lightning" element={<SendLightning />} />
            <Route path="/swap-details" element={<SwapDetails />} />
            {/* we are using camel case because screen name matches one in the mobile app */}
            <Route path="/SwapXArkDeposit" element={<SwapXArkDeposit />} />
            <Route path="/swap-xark-claim" element={<SwapXArkClaim />} />
            <Route path="/NftGallery" element={<NftGallery />} />
            <Route path="/Nft" element={<Nft />} />
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
        <div style={{ position: 'absolute', top: 0, right: 20 }}>
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
      <SWRConfig value={{ dedupingInterval: 5000, provider: () => new SwrCacheProvider() }}>
        <AskPasswordContextProvider>
          <AskMnemonicContextProvider>
            <ScanQrContextProvider>
              <InitializationContextProvider storage={LayerzStorage} backgroundCaller={BackgroundCaller} platform={'EXT'}>
                <SettingsContextProvider storage={LayerzStorage}>
                  <AccountNumberContextProvider storage={LayerzStorage} backgroundCaller={BackgroundCaller} messenger={Messenger}>
                    <NetworkContextProvider storage={LayerzStorage} backgroundCaller={BackgroundCaller} messenger={Messenger}>
                      <AppContent />
                    </NetworkContextProvider>
                  </AccountNumberContextProvider>
                </SettingsContextProvider>
              </InitializationContextProvider>
            </ScanQrContextProvider>
          </AskMnemonicContextProvider>
        </AskPasswordContextProvider>
      </SWRConfig>
    </Router>
  );
};

export default Popup;
