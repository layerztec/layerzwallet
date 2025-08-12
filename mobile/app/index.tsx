import { Redirect } from 'expo-router';
import React, { useContext } from 'react';

import { EStep, InitializationContext } from '@shared/hooks/InitializationContext';

export default function IndexScreen() {
  const { step } = useContext(InitializationContext);

  if (step === EStep.INTRO) {
    // New initial welcome screen before intro
    return <Redirect href="/onboarding/welcome" />;
  } else if (step === EStep.PASSWORD) {
    return <Redirect href="/onboarding/create-password" />;
  } else if (step === EStep.TOS) {
    return <Redirect href="/onboarding/tos" />;
  } else {
    return <Redirect href="/Home" />;
  }
}
