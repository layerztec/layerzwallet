import React, { createContext, ReactNode, useEffect, useState } from 'react';
import { IBackgroundCaller } from '../types/IBackgroundCaller';
import { IStorage } from '../types/IStorage';

export enum EStep {
  LOADING = 1,
  INTRO = 2,
  PASSWORD = 3,
  TOS = 4,
  READY = 5,
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
}

export const InitializationContextProvider: React.FC<InitializationProviderProps> = (props) => {
  const [step, setStep] = useState<EStep>(EStep.LOADING);
  const backgroundCaller = props.backgroundCaller;

  // initial load:
  useEffect(() => {
    (async () => {
      let s: EStep = EStep.LOADING;
      const hasAcceptedTermsOfService = await backgroundCaller.hasAcceptedTermsOfService();
      const hasMnemonic = await backgroundCaller.hasMnemonic();
      const hasEncryptedMnemonic = await backgroundCaller.hasEncryptedMnemonic();

      if (!hasMnemonic) {
        s = EStep.INTRO;
      } else if (!hasEncryptedMnemonic) {
        s = EStep.PASSWORD;
      } else if (!hasAcceptedTermsOfService) {
        s = EStep.TOS;
      } else {
        s = EStep.READY;
      }
      setStep(s);
    })();
  }, [backgroundCaller]);

  return <InitializationContext.Provider value={{ step, setStep }}>{step === EStep.LOADING ? null : props.children}</InitializationContext.Provider>;
};
