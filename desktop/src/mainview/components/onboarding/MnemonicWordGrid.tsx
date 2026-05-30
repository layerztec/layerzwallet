import React from "react";

type MnemonicWordGridProps = {
  words: string[];
  loading?: boolean;
};

export const MnemonicWordGrid: React.FC<MnemonicWordGridProps> = ({
  words,
  loading,
}) => {
  const slots = Array.from({ length: 12 }, (_, i) => words[i] ?? "");

  return (
    <div className="onboarding-mnemonic-grid">
      {slots.map((word, index) => (
        <div key={index} className="onboarding-word">
          <span className="onboarding-word__num">{index + 1}</span>
          {loading ? (
            <span className="onboarding-word__spinner" />
          ) : (
            <span className="onboarding-word__text">{word}</span>
          )}
        </div>
      ))}
    </div>
  );
};
