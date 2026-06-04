import React, { useCallback, useContext } from 'react';
import { HashRouter as Router, Navigate, Route, Routes } from 'react-router';
import { SWRConfig } from 'swr';

import '../modules/breeze-adapter'; // needed before BreezWallet
import '../modules/error-handler';
import '../modules/spark-adapter'; // needed before SparkWallet

import { AccountNumberContextProvider } from '@shared/hooks/AccountNumberContext';
import { EStep, InitializationContext, InitializationContextProvider } from '@shared/hooks/InitializationContext';
import { NetworkContextProvider } from '@shared/hooks/NetworkContext';
import { SettingsContextProvider } from '@shared/hooks/SettingsContext';
import { LayerzStorage } from '../class/layerz-storage';
import { SwrCacheProvider } from '../class/swr-cache-provider';
import { ActionPopupProvider } from '../contexts/ActionPopupContext';
import { AskMnemonicContextProvider } from '../hooks/AskMnemonicContext';
import { AskPasswordContextProvider } from '../hooks/AskPasswordContext';
import { BackgroundCaller } from '../modules/background-caller';
import { Messenger } from '../modules/messenger';
import { TunnelBootstrap } from '../components/mcp/TunnelBootstrap';
import { DesktopOmitArkNetworkGuard } from '../components/DesktopOmitArkNetworkGuard';
import ActionPopupModal from './ActionPopupModal';
import McpPermissionsModal from './McpPermissionsModal';
import McpTunnelUrlModal from './McpTunnelUrlModal';
import { WalletShell } from './WalletShell';
import Receive from './Receive';
import ReceiveOnLightningAddress from './ReceiveOnLightningAddress';
import SettingsPage from './SettingsPage';
import NftGallery from './NftGallery';
import Nft from './Nft';
import OnboardingCreatePassword from './OnboardingCreatePassword';
import OnboardingCreateWallet from './OnboardingCreateWallet';
import OnboardingCreateWalletIntro from './OnboardingCreateWalletIntro';
import OnboardingImportWallet from './OnboardingImportWallet';
import OnboardingIntro from './OnboardingIntro';
import OnboardingTos from './OnboardingTos';
import UnlockPassword from './UnlockPassword';
import './Popup.css';
import '../components/onboarding/Onboarding.css';

const AppContent: React.FC = () => {
  const { step } = useContext(InitializationContext);

  const Content: React.FC = useCallback(() => {
    switch (step) {
      case EStep.INTRO:
        return (
          <Routes>
            <Route path="/onboarding-intro" element={<OnboardingIntro />} />
            <Route path="/onboarding-create-wallet-intro" element={<OnboardingCreateWalletIntro />} />
            <Route path="/onboarding-create-wallet" element={<OnboardingCreateWallet />} />
            <Route path="/onboarding-import-wallet" element={<OnboardingImportWallet />} />
            <Route path="*" element={<Navigate to="/onboarding-intro" replace />} />
          </Routes>
        );

      case EStep.PASSWORD:
        return (
          <Routes>
            <Route path="/onboarding-create-password" element={<OnboardingCreatePassword />} />
            <Route path="*" element={<Navigate to="/onboarding-create-password" replace />} />
          </Routes>
        );

      case EStep.UNLOCK_PASSWORD:
        return (
          <Routes>
            <Route path="/unlock-password" element={<UnlockPassword />} />
            <Route path="*" element={<Navigate to="/unlock-password" replace />} />
          </Routes>
        );

      case EStep.TOS:
        return (
          <Routes>
            <Route path="/onboarding-tos" element={<OnboardingTos />} />
            <Route path="*" element={<Navigate to="/onboarding-tos" replace />} />
          </Routes>
        );

      case EStep.READY:
        return (
          <>
            <TunnelBootstrap />
            <Routes>
              <Route element={<WalletShell />}>
                <Route path="/home" />
                <Route path="/receive" element={<Receive />} />
                <Route path="/receive-on-lightning-address" element={<ReceiveOnLightningAddress />} />
                <Route path="/action-popup-modal" element={<ActionPopupModal />} />
                <Route path="/mcp-permissions-modal" element={<McpPermissionsModal />} />
                <Route path="/mcp-tunnel-url-modal" element={<McpTunnelUrlModal />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/nft-gallery" element={<NftGallery />} />
                <Route path="/nft" element={<Nft />} />
                <Route path="/" element={<Navigate to="/home" replace />} />
                <Route path="*" element={<Navigate to="/home" replace />} />
              </Route>
            </Routes>
          </>
        );
    }
  }, [step]);

  const isWalletShell = step === EStep.READY;
  const isUnlock = step === EStep.UNLOCK_PASSWORD;
  const appClass = isWalletShell || isUnlock ? 'App App--wallet' : 'App App--onboarding';

  return (
    <div className={appClass}>
      <Content />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <SWRConfig
        value={{
          dedupingInterval: 5000,
          provider: () => new SwrCacheProvider(),
        }}
      >
        <AskPasswordContextProvider>
          <AskMnemonicContextProvider>
            <InitializationContextProvider storage={LayerzStorage} backgroundCaller={BackgroundCaller} platform="DESKTOP">
              <SettingsContextProvider storage={LayerzStorage}>
                <AccountNumberContextProvider storage={LayerzStorage} backgroundCaller={BackgroundCaller} messenger={Messenger}>
                  <NetworkContextProvider storage={LayerzStorage} backgroundCaller={BackgroundCaller} messenger={Messenger}>
                    <DesktopOmitArkNetworkGuard />
                    <ActionPopupProvider>
                      <AppContent />
                    </ActionPopupProvider>
                  </NetworkContextProvider>
                </AccountNumberContextProvider>
              </SettingsContextProvider>
            </InitializationContextProvider>
          </AskMnemonicContextProvider>
        </AskPasswordContextProvider>
      </SWRConfig>
    </Router>
  );
};

export default App;
