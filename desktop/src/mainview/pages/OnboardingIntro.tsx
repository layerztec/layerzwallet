import React from 'react';
import { useNavigate } from 'react-router';

import { OnboardingPrimaryButton, OnboardingSecondaryButton, OnboardingShell } from '../components/onboarding/OnboardingShell';
import { layerzLogo } from '../utils/onboarding-assets';

const OnboardingIntro: React.FC = () => {
  const navigate = useNavigate();

  return (
    <OnboardingShell
      footer={
        <>
          <OnboardingPrimaryButton onClick={() => navigate('/onboarding-create-wallet-intro')}>Create Wallet</OnboardingPrimaryButton>
          <OnboardingSecondaryButton onClick={() => navigate('/onboarding-import-wallet')}>Import Wallet</OnboardingSecondaryButton>
        </>
      }
    >
      <div className="onboarding-logo">
        <img src={layerzLogo} alt="Layerz" className="onboarding-logo__img" />
      </div>
      <h1 className="onboarding-title">Welcome to Layerz</h1>
      <p className="onboarding-tagline">From A–Z, You&apos;re in Control</p>
    </OnboardingShell>
  );
};

export default OnboardingIntro;
