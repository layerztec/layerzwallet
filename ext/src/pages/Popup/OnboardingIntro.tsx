import React from 'react';
import { useNavigate } from 'react-router';
import { Button } from './DesignSystem';

const OnboardingIntro: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div>
      <h2>onboarding-intro</h2>

      <Button
        onClick={() => {
          navigate('/onboarding-import-wallet');
        }}
      >
        Import wallet
      </Button>
      <span> </span>
      <Button
        onClick={() => {
          navigate('/onboarding-create-wallet');
        }}
      >
        Create wallet
      </Button>
    </div>
  );
};

export default OnboardingIntro;
