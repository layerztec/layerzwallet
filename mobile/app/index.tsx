import { Redirect } from 'expo-router';
import React, { useContext } from 'react';

import { EStep, InitializationContext } from '@shared/hooks/InitializationContext';
import { useAppLock } from '@/src/hooks/useAppLock';

export default function IndexScreen() {
  const { step } = useContext(InitializationContext);
  const { lockState, isBiometricEnabled } = useAppLock();

  // Handle onboarding steps first
  if (step === EStep.INTRO) {
    return <Redirect href="/onboarding/intro" />;
  } else if (step === EStep.PASSWORD) {
    return <Redirect href="/onboarding/create-password" />;
  } else if (step === EStep.TOS) {
    return <Redirect href="/onboarding/tos" />;
  }

  // Only proceed to lock/home logic if initialization is complete
  if (step === EStep.READY) {
    // Always navigate to Home - the global modal overlay will handle unlock UI without affecting navigation
    return <Redirect href="/Home" />;
  }

  // For any other state, go to home (fallback)
  return <Redirect href="/Home" />;
}
