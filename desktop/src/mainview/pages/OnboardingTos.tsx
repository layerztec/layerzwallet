import { AccountNumberContext } from "@shared/hooks/AccountNumberContext";
import {
  EStep,
  InitializationContext,
} from "@shared/hooks/InitializationContext";
import React, { useContext, useState } from "react";
import { useNavigate } from "react-router";

import { OnboardingShell } from "../components/onboarding/OnboardingShell";
import { BackgroundCaller } from "../modules/background-caller";
import { successIcon } from "../utils/onboarding-assets";

const TOS_URL = "https://layerzwallet.com/tos";

const OnboardingTos: React.FC = () => {
  const navigate = useNavigate();
  const { setStep } = useContext(InitializationContext);
  const { setAccountNumber } = useContext(AccountNumberContext);
  const [isLoading, setIsLoading] = useState(false);
  const [backupChecked, setBackupChecked] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);

  const isButtonEnabled = backupChecked && termsChecked && !isLoading;

  const handleAgree = async () => {
    if (!backupChecked || !termsChecked) {
      window.alert(
        "You must confirm that you have backed up your recovery phrase and accept the terms of service to continue.",
      );
      return;
    }

    setIsLoading(true);
    try {
      await BackgroundCaller.acceptTermsOfService();
      setAccountNumber(0);
      setStep(EStep.READY);
      navigate("/home");
    } catch (error) {
      console.error("Error accepting terms:", error);
      setIsLoading(false);
    }
  };

  const toggleCheckbox = (type: "backup" | "terms") => {
    if (type === "backup") {
      setBackupChecked((v) => !v);
    } else {
      setTermsChecked((v) => !v);
    }
  };

  return (
    <OnboardingShell
      bodyAlign="top"
      footer={
        <button
          type="button"
          className="onboarding-btn onboarding-btn--soft"
          onClick={handleAgree}
          disabled={!isButtonEnabled}
        >
          {isLoading ? "Processing..." : "Let's go"}
        </button>
      }
    >
      <div className="onboarding-tos">
        <div className="onboarding-tos__hero">
          <img src={successIcon} alt="" className="onboarding-hero-icon" />
          <h1 className="onboarding-title">
            Wallet created
            <br />
            successfully
          </h1>
          <p className="onboarding-subtitle">
            You are now ready to access your wallet and unlock the full
            potential that Bitcoin has to offer via Layer2
          </p>
        </div>

        <div className="onboarding-tos__checkboxes">
          <button
            type="button"
            className="onboarding-checkbox-row"
            onClick={() => toggleCheckbox("backup")}
          >
            <span
              className={`onboarding-checkbox${backupChecked ? " onboarding-checkbox--checked" : ""}`}
              aria-hidden
            >
              {backupChecked ? (
                <span className="onboarding-checkbox__mark">✓</span>
              ) : null}
            </span>
            <span className="onboarding-checkbox-label">
              I have backed up my recovery phrase and I understand I cannot
              recover my wallet without it.
            </span>
          </button>

          <div
            className="onboarding-checkbox-row"
            role="checkbox"
            aria-checked={termsChecked}
            tabIndex={0}
            onClick={() => toggleCheckbox("terms")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleCheckbox("terms");
              }
            }}
          >
            <span
              className={`onboarding-checkbox${termsChecked ? " onboarding-checkbox--checked" : ""}`}
              aria-hidden
            >
              {termsChecked ? (
                <span className="onboarding-checkbox__mark">✓</span>
              ) : null}
            </span>
            <span className="onboarding-checkbox-label">
              I have read and accept the{" "}
              <a
                href={TOS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="onboarding-checkbox-link"
                onClick={(e) => e.stopPropagation()}
              >
                Terms of Service
              </a>{" "}
              of Layerz Tec Ltd.
            </span>
          </div>
        </div>
      </div>
    </OnboardingShell>
  );
};

export default OnboardingTos;
