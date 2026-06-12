import React, { useState } from 'react';
import { useNavigate } from 'react-router';

import { BackgroundCaller } from '../modules/background-caller';
import { OnboardingPrimaryButton, OnboardingShell } from '../components/onboarding/OnboardingShell';
import { newWalletIcon } from '../utils/onboarding-assets';

const OnboardingCreateWalletIntro: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    setIsLoading(true);
    try {
      const hasMnemonic = await BackgroundCaller.hasMnemonic();
      let mnemonic = '';

      if (!hasMnemonic) {
        const response = await BackgroundCaller.createMnemonic();
        mnemonic = response.mnemonic;
      }

      navigate('/onboarding-create-wallet', {
        state: { mnemonic, showLoading: true },
      });
    } catch (error) {
      console.error('Error creating wallet:', error);
      setIsLoading(false);
    }
  };

  return (
    <OnboardingShell
      onBack={() => navigate('/onboarding-intro')}
      footer={
        <OnboardingPrimaryButton onClick={handleContinue} disabled={isLoading} showArrow>
          {isLoading ? 'Loading...' : 'Continue'}
        </OnboardingPrimaryButton>
      }
    >
      <img src={newWalletIcon} alt="" className="onboarding-hero-icon" />
      <h1 className="onboarding-title">Generating your new recovery phrase</h1>
      <p className="onboarding-subtitle">
        A recovery phrase is a series of 12 words in a specific order. This word combination is unique to your wallet. Make sure to have pen and paper ready so you can write it down.
      </p>
    </OnboardingShell>
  );
};

export default OnboardingCreateWalletIntro;
