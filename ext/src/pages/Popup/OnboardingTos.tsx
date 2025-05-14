import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { EStep, InitializationContext } from '@shared/hooks/InitializationContext';
import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router';
import { BackgroundCaller } from '../../modules/background-caller';
import { Button } from './DesignSystem';

const OnboardingIntro: React.FC = () => {
  const navigate = useNavigate();
  const { setStep } = useContext(InitializationContext);
  const { setAccountNumber } = useContext(AccountNumberContext);
  const [showWarning, setShowWarning] = useState(false);

  return (
    <div>
      <h2>Terms of service</h2>

      <div>
        This software is provided as a Developer Preview for testing and evaluation purposes only. It is offered "as is" without any warranties, express or implied. The author assumes no liability or
        responsibility for any loss, damages, or issues arising from its use, including but not limited to financial loss or data security breaches. By using this software, you acknowledge that it is
        a non-custodial tool and accept full responsibility for managing your own Bitcoin and private keys. Use at your own risk.
      </div>

      <br />

      {showWarning && <div style={{ color: 'red', marginBottom: '10px' }}>It's impossible to continue without accepting the Terms of Service.</div>}

      <Button
        onClick={async () => {
          await BackgroundCaller.acceptTermsOfService();
          setAccountNumber(0);

          setStep(EStep.READY);
          navigate('/');
        }}
      >
        Accept Terms
      </Button>
      <span> </span>
      <Button
        onClick={() => {
          setShowWarning(true);
        }}
      >
        Do Not Accept
      </Button>
    </div>
  );
};

export default OnboardingIntro;
