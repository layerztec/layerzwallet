import assert from 'assert';
import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router';

import { EStep, InitializationContext } from '@shared/hooks/InitializationContext';
import { getDeviceID } from '@shared/modules/device-id';
import { ENCRYPTED_PREFIX, STORAGE_KEY_MNEMONIC } from '@shared/types/IStorage';
import { NETWORK_BITCOIN } from '@shared/types/networks';

import { Csprng } from '../class/rng';
import { SecureStorage } from '../class/secure-storage';
import { RadialGradientScreen } from '../components/home/RadialGradientScreen';
import { BackgroundCaller } from '../modules/background-caller';
import { decrypt } from '../modules/encryption';

import './UnlockPassword.css';

export default function UnlockPassword() {
  const navigate = useNavigate();
  const { setStep } = useContext(InitializationContext);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUnlock = async () => {
    if (!password.trim() || isLoading) return;

    setIsLoading(true);
    setError('');

    try {
      const encryptedMnemonic = await SecureStorage.getItem(STORAGE_KEY_MNEMONIC);
      assert(encryptedMnemonic, 'No encrypted mnemonic found');
      assert(encryptedMnemonic.startsWith(ENCRYPTED_PREFIX), 'Mnemonic not encrypted, reinstall the app');

      const decrypted = await decrypt(encryptedMnemonic.replace(ENCRYPTED_PREFIX, ''), password, await getDeviceID(SecureStorage, Csprng));
      await BackgroundCaller.setMasterSeed(decrypted);
      setStep(EStep.READY);
      navigate('/home');
    } catch {
      setError('Incorrect password. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <RadialGradientScreen network={NETWORK_BITCOIN} className="unlock-screen">
      <div className="unlock-content">
        <h1 className="unlock-title">Unlock wallet</h1>
        <p className="unlock-subtitle">Enter your password to unlock your wallet</p>

        {error ? (
          <p className="unlock-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="unlock-field">
          <div className="unlock-input-wrap">
            <input
              id="unlock-password-input"
              data-testid="EnterPasswordInput"
              className="unlock-input"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleUnlock();
              }}
              disabled={isLoading}
              aria-label="Password"
            />
          </div>
        </div>

        <button type="button" className="unlock-btn" onClick={() => void handleUnlock()} disabled={isLoading || !password.trim()} data-testid="UnlockPasswordButton">
          {isLoading ? 'Unlocking…' : 'Unlock'}
        </button>
      </div>
    </RadialGradientScreen>
  );
}
