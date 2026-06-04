import { EStep, InitializationContext } from '@shared/hooks/InitializationContext';
import { sanitizeAndValidateMnemonic } from '@shared/modules/wallet-utils';
import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router';

import { OnboardingPrimaryButton, OnboardingShell } from '../components/onboarding/OnboardingShell';
import { BackgroundCaller } from '../modules/background-caller';
import { importingIcon } from '../utils/onboarding-assets';

export default function OnboardingImportWallet() {
  const navigate = useNavigate();
  const { setStep } = useContext(InitializationContext);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleImport = async () => {
    if (!value.trim()) {
      setError('Please enter your seed phrase');
      return;
    }

    let sanitizedSeed = '';
    try {
      sanitizedSeed = sanitizeAndValidateMnemonic(value);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid mnemonic seed');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await new Promise((r) => setTimeout(r, 400));
      const response = await BackgroundCaller.saveMnemonic(sanitizedSeed);

      if (!response) {
        setError('Invalid mnemonic seed');
        setIsLoading(false);
        return;
      }

      await BackgroundCaller.setMasterSeed(sanitizedSeed);
      setStep(EStep.PASSWORD);
      navigate('/onboarding-create-password');
    } catch {
      setError('An error occurred while importing the wallet');
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <OnboardingShell bodyAlign="center">
        <div className="onboarding-loading-center">
          <img src={importingIcon} alt="" />
          <h1 className="onboarding-title onboarding-title--sm">Importing wallet...</h1>
          <p className="onboarding-subtitle">
            We&apos;re verifying your seed phrase and setting up your wallet.
            <br />
            This may take a few moments.
          </p>
        </div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      onBack={() => navigate('/onboarding-intro')}
      bodyAlign="top"
      footer={
        <OnboardingPrimaryButton onClick={handleImport} disabled={!value.trim()} showArrow>
          Import
        </OnboardingPrimaryButton>
      }
    >
      <h1 className="onboarding-title onboarding-title--sm">Import your wallet</h1>
      <p className="onboarding-subtitle">Enter your secret recovery phrase to import your wallet.</p>
      <textarea
        className="onboarding-textarea"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter your recovery phrase or paste your private key here"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
      />
      {error ? <p className="onboarding-error">{error}</p> : null}
    </OnboardingShell>
  );
}
