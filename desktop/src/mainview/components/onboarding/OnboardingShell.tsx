import React from "react";
import "./Onboarding.css";

type OnboardingShellProps = {
  children: React.ReactNode;
  footer?: React.ReactNode;
  onBack?: () => void;
  bodyAlign?: "center" | "top";
};

export const OnboardingBackButton: React.FC<{ onClick: () => void }> = ({
  onClick,
}) => (
  <button
    type="button"
    className="onboarding-back"
    onClick={onClick}
    aria-label="Back"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  </button>
);

export const OnboardingShell: React.FC<OnboardingShellProps> = ({
  children,
  footer,
  onBack,
  bodyAlign = "center",
}) => {
  return (
    <div className="onboarding-shell">
      <div className="onboarding-shell__inner">
        {onBack ? (
          <header className="onboarding-shell__header">
            <OnboardingBackButton onClick={onBack} />
          </header>
        ) : (
          <div className="onboarding-shell__header" aria-hidden />
        )}
        <main
          className={`onboarding-shell__body${bodyAlign === "top" ? " onboarding-shell__body--top" : ""}`}
        >
          {children}
        </main>
        {footer ? (
          <footer className="onboarding-shell__footer">{footer}</footer>
        ) : null}
      </div>
    </div>
  );
};

export const OnboardingPrimaryButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  showArrow?: boolean;
}> = ({ children, onClick, disabled, type = "button", showArrow }) => (
  <button
    type={type}
    className="onboarding-btn onboarding-btn--primary"
    onClick={onClick}
    disabled={disabled}
  >
    {showArrow ? (
      <span className="onboarding-btn__icon-circle" aria-hidden>
        <span className="onboarding-btn__icon-arrow">→</span>
      </span>
    ) : null}
    {children}
  </button>
);

export const OnboardingSecondaryButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}> = ({ children, onClick, disabled }) => (
  <button
    type="button"
    className="onboarding-btn onboarding-btn--secondary"
    onClick={onClick}
    disabled={disabled}
  >
    {children}
  </button>
);

export const OnboardingGhostButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}> = ({ children, onClick, disabled }) => (
  <button
    type="button"
    className="onboarding-btn onboarding-btn--ghost"
    onClick={onClick}
    disabled={disabled}
  >
    {children}
  </button>
);
