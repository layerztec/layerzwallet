import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './DesignSystem';
import { Import, PlusCircle } from 'lucide-react';

const OnboardingIntro: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div>
      <h2>onboarding-intro</h2>

      <Button
        onClick={() => {
          navigate('/onboarding-import-wallet');
        }}
        icon={<Import size={16} />}
        iconPosition="left"
      >
        Import wallet
      </Button>
      <span> </span>
      <Button
        onClick={() => {
          navigate('/onboarding-create-wallet');
        }}
        icon={<PlusCircle size={16} />}
        iconPosition="left"
      >
        Create wallet
      </Button>
    </div>
  );
};

export default OnboardingIntro;
