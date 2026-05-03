import { CloudOff, Loader2, AlertTriangle } from 'lucide-react';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { RgbBackupServerUnreachableError } from '@shared/class/wallets/rgb-wallet';
import { EStep, InitializationContext } from '@shared/hooks/InitializationContext';
import { NETWORK_RGB_TESTNET } from '@shared/types/networks';

import { BackgroundCaller } from '../../modules/background-caller';
import { ThemedText } from '../../components/ThemedText';
import { Button, WideButton } from './DesignSystem';

const TARGET_NEXT = '/onboarding-tos';
const PENDING_FLAG = 'rgb.justImported';

type Status = 'probing' | 'failed';

/**
 * Restore-from-seed gate. Sits between password and TOS on the import path.
 *
 * The new init() flow refuses to silently create a fresh RGB wallet when VSS
 * is unreachable (would overwrite the real backup with empty state). We
 * surface that *during onboarding* — not on first RGB tap — so a user
 * restoring on a flaky network gets a clear "VSS server unreachable, retry?"
 * before they're dropped into the wallet UI.
 *
 * On Skip the user proceeds to TOS; subsequent RGB inits still fail with
 * the same typed error, so the safety net is never bypassed.
 *
 * See tasks/rgb-backup-failure-handling.md.
 */
const OnboardingVerifyingRgbBackup: React.FC = () => {
  const navigate = useNavigate();
  const { setStep } = useContext(InitializationContext);
  const [status, setStatus] = useState<Status>('probing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<'unreachable' | 'other'>('unreachable');

  const proceed = useCallback(() => {
    sessionStorage.removeItem(PENDING_FLAG);
    // Same race avoidance as the password screen: navigate first, then bump
    // the EStep so the new Routes block is mounted with the URL already at
    // /onboarding-tos.
    navigate(TARGET_NEXT, { replace: true });
    setStep(EStep.TOS);
  }, [navigate, setStep]);

  const probe = useCallback(async () => {
    setStatus('probing');
    setErrorMessage(null);
    try {
      // Testnet is intentional — VSS server URL is shared with mainnet so
      // reachability is correlated, and a successful init pre-warms the
      // cache for the first RGB tap.
      await BackgroundCaller.lazyInitWallet(NETWORK_RGB_TESTNET, 0);
      proceed();
    } catch (e: any) {
      if (e instanceof RgbBackupServerUnreachableError) {
        setErrorKind('unreachable');
        setErrorMessage('Backup server is unreachable. We can’t verify your RGB backup right now.');
      } else {
        setErrorKind('other');
        setErrorMessage(typeof e?.message === 'string' ? e.message : 'Could not verify your RGB backup.');
      }
      setStatus('failed');
    }
  }, [proceed]);

  useEffect(() => {
    probe();
  }, [probe]);

  const accent = errorKind === 'unreachable' ? 'rgba(255, 255, 255, 0.9)' : '#ffb86b';

  return (
    <div style={{ textAlign: 'center', paddingTop: 32 }}>
      <div style={{ height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        {status === 'probing' ? (
          <Loader2 size={56} className="rgb-verify-spin" color="rgba(255, 255, 255, 0.95)" />
        ) : errorKind === 'unreachable' ? (
          <CloudOff size={64} color={accent} />
        ) : (
          <AlertTriangle size={64} color={accent} />
        )}
      </div>

      <ThemedText type="headline">{status === 'probing' ? 'Verifying RGB backup…' : 'Backup not verified'}</ThemedText>

      <p
        style={{
          color: 'rgba(255, 255, 255, 0.75)',
          fontSize: 14,
          lineHeight: '20px',
          padding: '0 16px',
          marginTop: 12,
        }}
      >
        {status === 'probing'
          ? 'Checking that your RGB backup is reachable before we restore your wallet. This is a one-time step.'
          : (errorMessage ?? 'Unknown error') + ' You can skip RGB for now and try again later from the home banner.'}
      </p>

      {status === 'failed' ? (
        <div style={{ marginTop: 24, padding: '0 16px' }}>
          <WideButton onClick={probe} data-testid="VerifyingRgbBackup.Retry">
            Retry
          </WideButton>
          <div style={{ marginTop: 10 }}>
            <Button onClick={proceed} data-testid="VerifyingRgbBackup.Skip">
              Skip RGB for now
            </Button>
          </div>
        </div>
      ) : null}

      <style>
        {`@keyframes rgb-verify-spin { to { transform: rotate(360deg); } }
          .rgb-verify-spin { animation: rgb-verify-spin 1s linear infinite; transform-origin: center; }`}
      </style>
    </div>
  );
};

export default OnboardingVerifyingRgbBackup;
