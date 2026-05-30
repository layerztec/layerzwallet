import {
  EStep,
  InitializationContext,
} from "@shared/hooks/InitializationContext";
import React, { useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import { MnemonicWordGrid } from "../components/onboarding/MnemonicWordGrid";
import {
  OnboardingPrimaryButton,
  OnboardingShell,
} from "../components/onboarding/OnboardingShell";
import { BackgroundCaller } from "../modules/background-caller";

type LocationState = {
  mnemonic?: string;
  showLoading?: boolean;
};

const LOADING_MS = 1200;

const OnboardingCreateWallet: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;
  const { setStep } = useContext(InitializationContext);
  const [recoveryPhrase, setRecoveryPhrase] = useState<string>(
    state.mnemonic ?? "",
  );
  const [isLoading, setIsLoading] = useState(
    Boolean(state.showLoading && state.mnemonic),
  );
  const [error, setError] = useState("");

  const words = useMemo(
    () => (recoveryPhrase ? recoveryPhrase.split(" ") : []),
    [recoveryPhrase],
  );

  const goToPassword = () => {
    setStep(EStep.PASSWORD);
    navigate("/onboarding-create-password");
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        let mnemonic = state.mnemonic ?? "";

        if (!mnemonic) {
          const hasMnemonic = await BackgroundCaller.hasMnemonic();
          if (!hasMnemonic) {
            setIsLoading(true);
            const response = await BackgroundCaller.createMnemonic();
            mnemonic = response.mnemonic;
          }
        }

        if (!mnemonic) {
          setError("No recovery phrase available");
          setIsLoading(false);
          return;
        }

        if (state.showLoading) {
          await new Promise((r) => setTimeout(r, LOADING_MS));
        }

        if (cancelled) return;

        await BackgroundCaller.setMasterSeed(mnemonic);
        setRecoveryPhrase(mnemonic);
        setIsLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError("Failed to create wallet");
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state.mnemonic, state.showLoading]);

  return (
    <OnboardingShell
      onBack={() => navigate("/onboarding-create-wallet-intro")}
      bodyAlign="top"
      footer={
        !isLoading && !error && recoveryPhrase ? (
          <OnboardingPrimaryButton onClick={goToPassword} showArrow>
            Continue
          </OnboardingPrimaryButton>
        ) : null
      }
    >
      {isLoading ? (
        <>
          <h1 className="onboarding-title onboarding-title--sm">
            Creating your wallet...
          </h1>
          <MnemonicWordGrid words={[]} loading />
        </>
      ) : error ? (
        <p className="onboarding-error">{error}</p>
      ) : (
        <>
          <h1 className="onboarding-title onboarding-title--sm">
            This is your recovery phrase
          </h1>
          <p className="onboarding-subtitle">
            Make sure to write it down as shown here.
            <br />
            You have to verify this later.
          </p>
          <MnemonicWordGrid words={words} />
        </>
      )}
    </OnboardingShell>
  );
};

export default OnboardingCreateWallet;
