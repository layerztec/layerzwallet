import React, { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router';

import { ThemedText } from '../../components/ThemedText';
import { AskMnemonicContext } from '../../hooks/AskMnemonicContext';
import { BackgroundCaller } from '../../modules/background-caller';
import { Button } from './DesignSystem';
import { EStep, InitializationContext } from '@shared/hooks/InitializationContext';

export default function UnlockPassword() {
  const navigate = useNavigate();
  const { setStep } = useContext(InitializationContext);
  const { askMnemonic } = useContext(AskMnemonicContext);

  const triggerUnlock = async () => {
    const mnemonic = await askMnemonic();
    if (mnemonic) {
      console.log('have mnemonic, going home');
      await BackgroundCaller.setMasterSeed(mnemonic);
      setStep(EStep.READY);
      navigate('/');
    }
  };

  useEffect(() => {
    triggerUnlock();
    // need to trigger it only once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <ThemedText type="headline">Unlock your wallet</ThemedText>
      <ThemedText type="paragraph">Enter password to unlock your wallet</ThemedText>

      <Button onClick={triggerUnlock}>Unlock wallet</Button>
    </div>
  );
}
