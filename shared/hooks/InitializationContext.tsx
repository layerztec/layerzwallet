import React, { createContext, ReactNode, useEffect, useState } from 'react';
import { IBackgroundCaller } from '../types/IBackgroundCaller';
import { IStorage } from '../types/IStorage';

export enum EStep {
  LOADING = 1,
  INTRO = 2,
  UNLOCK_PASSWORD = 3,
  TOS = 4,
  READY = 5,
  PASSWORD = 6,
}

interface IInitializationContext {
  step: EStep;
  setStep: React.Dispatch<React.SetStateAction<EStep>>;
}

export const InitializationContext = createContext<IInitializationContext>({
  step: EStep.LOADING,
  setStep: () => {
    throw new Error('This should never happen');
  },
});

interface InitializationProviderProps {
  children: ReactNode;
  storage: IStorage;
  backgroundCaller: IBackgroundCaller;
  platform: 'EXT' | 'MOBILE';
}

export const InitializationContextProvider: React.FC<InitializationProviderProps> = (props) => {
  const [step, setStep] = useState<EStep>(EStep.LOADING);
  const backgroundCaller = props.backgroundCaller;
  const platform = props.platform;

  // initial load:
  useEffect(() => {
    (async () => {
      let s: EStep = EStep.LOADING;
      const hasAcceptedTermsOfService = await backgroundCaller.hasAcceptedTermsOfService();
      const hasMnemonic = await backgroundCaller.hasMnemonic();
      const hasEncryptedMnemonic = await backgroundCaller.hasEncryptedMnemonic();

      let hasMasterSeedLoaded: boolean = false;
      try {
        hasMasterSeedLoaded = !!(await backgroundCaller.getMasterSeed());
      } catch {}

      if (!hasMnemonic) {
        s = EStep.INTRO;
      } else if (platform === 'EXT' && hasMnemonic && !hasEncryptedMnemonic) {
        // on EXT its OBLIGATORY to encrypt seed since its less secure environment
        s = EStep.PASSWORD;
      } else if (!hasAcceptedTermsOfService) {
        s = EStep.TOS;
      } else if (hasEncryptedMnemonic && !hasMasterSeedLoaded) {
        // seed is encrypted, we dont have seed cached, and we cant fully start without it. we demand password to decrypt it:
        s = EStep.UNLOCK_PASSWORD;
      } else {
        if (!hasEncryptedMnemonic) {
          // caching master seed:
          const seed = await backgroundCaller.getMnemonicForVerification();
          await backgroundCaller.setMasterSeed(String(seed));
        }

        s = EStep.READY;
      }

      setStep(s);
    })();
  }, [backgroundCaller, platform]);

  return <InitializationContext.Provider value={{ step, setStep }}>{step === EStep.LOADING ? null : props.children}</InitializationContext.Provider>;
};
