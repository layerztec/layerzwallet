import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router';

import { EStep, InitializationContext } from '@shared/hooks/InitializationContext';
import { BackgroundCaller } from '../modules/background-caller';
import { OnboardingPrimaryButton, OnboardingShell } from '../components/onboarding/OnboardingShell';

export default function OnboardingCreatePassword() {
  const navigate = useNavigate();
  const { setStep } = useContext(InitializationContext);
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const arePasswordsEqual = Boolean(pass1 && pass1 === pass2);
  const [validationError, setValidationError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSavePassword = async () => {
    if (pass1 !== pass2) {
      setValidationError('Passwords do not match');
      return;
    }

    if (pass1.length < 2) {
      setValidationError('Password must be at least 2 characters long');
      return;
    }

    setIsLoading(true);
    setValidationError('');

    try {
      await BackgroundCaller.encryptMnemonic(pass1);
      setStep(EStep.TOS);
      navigate('/onboarding-tos');
    } catch {
      setValidationError('An error occurred');
      setIsLoading(false);
    }
  };

  return (
    <OnboardingShell
      bodyAlign="top"
      footer={
        <OnboardingPrimaryButton onClick={handleSavePassword} disabled={!arePasswordsEqual || isLoading} showArrow>
          {isLoading ? 'Creating...' : 'Create Password'}
        </OnboardingPrimaryButton>
      }
    >
      <h1 className="onboarding-title">Create Password</h1>
      <p className="onboarding-subtitle">Create a password to encrypt your wallet</p>
      <div className="onboarding-input-stack">
        <input className="onboarding-input" type="password" placeholder="Enter password" value={pass1} onChange={(e) => setPass1(e.target.value)} autoComplete="new-password" />
        <input
          className="onboarding-input"
          type="password"
          placeholder="Repeat password"
          value={pass2}
          onChange={(e) => setPass2(e.target.value)}
          autoComplete="new-password"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && arePasswordsEqual && !isLoading) handleSavePassword();
          }}
        />
      </div>
      {validationError ? <p className="onboarding-error">{validationError}</p> : null}
    </OnboardingShell>
  );
}
