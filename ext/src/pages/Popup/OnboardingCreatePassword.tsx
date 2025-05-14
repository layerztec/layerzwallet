import { EStep, InitializationContext } from '@shared/hooks/InitializationContext';
import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router';
import { BackgroundCaller } from '../../modules/background-caller';
import { Button, Input } from './DesignSystem';

export default function OnboardingCreatePassword() {
  const navigate = useNavigate();
  const { setStep } = useContext(InitializationContext);
  const [pass1, setPass1] = useState<string>('');
  const [pass2, setPass2] = useState<string>('');
  const arePasswordsEqual = pass1 && pass1 === pass2;
  const [validationError, setValidationError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSavePassword = async () => {
    if (pass1 !== pass2) {
      setValidationError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      await BackgroundCaller.encryptMnemonic(pass1);
      setStep(EStep.TOS);
      navigate('/onboarding-tos');
    } catch (error) {
      setValidationError('An error occurred');
      setIsLoading(false);
    }
  };

  const onPass1Change = (value: React.ChangeEvent<HTMLInputElement>) => {
    console.log(value.target.value);
    setPass1(value.target.value);
  };

  const onPass2Change = (value: any) => {
    console.log(value.target.value);
    setPass2(value.target.value);
  };

  return (
    <div>
      <h2>Create your password</h2>
      <p>Enter password to secure & lock your wallet</p>
      <br />

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div>
          <Input type="password" name="password" placeholder="Type password" onChange={onPass1Change} />
          <Input type="password" name="password_repeat" placeholder="Confirm password" onChange={onPass2Change} />
          {!!validationError && <div>{validationError}</div>}
          <br />
          <br />
          <Button onClick={handleSavePassword} disabled={!arePasswordsEqual || isLoading}>
            Set password
          </Button>
        </div>
      )}
    </div>
  );
}
