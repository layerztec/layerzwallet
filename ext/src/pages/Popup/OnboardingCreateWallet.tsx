import { EStep, InitializationContext } from '@shared/hooks/InitializationContext';
import React, { useContext, useEffect, useState } from 'react';
import { BackgroundCaller } from '../../modules/background-caller';
import { Bubble, Button } from './DesignSystem';
import { ThemedText } from '../../components/ThemedText';

const OnboardingCreateWallet: React.FC = () => {
  const [recoveryPhrase, setRecoveryPhrase] = useState<string>('');
  const [error, setError] = useState<string>('');
  const { setStep } = useContext(InitializationContext);

  const handleNext = async () => {
    setStep(EStep.PASSWORD);
  };

  useEffect(() => {
    (async () => {
      try {
        const hasMnemonic = await BackgroundCaller.hasMnemonic();

        if (!hasMnemonic) {
          const response = await BackgroundCaller.createMnemonic();
          setRecoveryPhrase(response.mnemonic);
        }
      } catch (error: any) {
        setError(`Failed to create wallet: ${error.message}`);
      }
    })();
  }, []);

  const words = recoveryPhrase ? recoveryPhrase.split(' ') : [];

  return (
    <>
      <div>
        <div>
          <ThemedText type="headline">Your secret recovery phrase</ThemedText>
        </div>
        <div>
          <ThemedText type="paragraph">Write down these 12 words in numerical order and keep them in a secure place. Never share them with anyone.</ThemedText>
        </div>

        {error && (
          <div>
            <ThemedText style={{ color: 'red', marginBottom: '10px' }} type="paragraph">
              Error: {error}
            </ThemedText>
          </div>
        )}

        <div>
          {words.map((word, index) => (
            <span key={index}>
              <Bubble>
                <ThemedText type="defaultSemiBold">
                  {index + 1}. {word}
                </ThemedText>
              </Bubble>
            </span>
          ))}
        </div>
      </div>

      <br />
      <Button onClick={handleNext} disabled={!recoveryPhrase}>
        <ThemedText>Next</ThemedText>
      </Button>
    </>
  );
};

export default OnboardingCreateWallet;
