import { router } from 'expo-router';
import { useContext, useEffect, useRef, useSyncExternalStore } from 'react';

import { wcService } from '@/src/features/walletconnect/modules/wc-service';
import { AuthStateContext } from '@/src/hooks/AuthStateContext';
import { EStep, InitializationContext } from '@shared/hooks/InitializationContext';

/**
 * Render-nothing bootstrap (mounted next to TunnelBootstrap in _layout):
 * - boots WalletKit only once initialization reaches READY (for encrypted
 *   wallets the master seed does not exist before the unlock screen — an
 *   earlier boot would fail resolveAccount and never retry) and only when a
 *   previous run had active sessions;
 * - surfaces service prompts as the approval modal route, but never over
 *   the biometric lock: a consent sheet must not be approvable by whoever
 *   holds a locked device. Deferred prompts expire on their own timers.
 */
export function WcBootstrap() {
  const { step } = useContext(InitializationContext);
  const { isAuthenticated, isBiometricEnabled } = useContext(AuthStateContext);
  const state = useSyncExternalStore(wcService.subscribe, wcService.snapshot, wcService.snapshot);
  const booted = useRef(false);
  const pushedFor = useRef<object | null>(null);

  // The consent sheet must not sit over the biometric lock, but gating on
  // raw `isAuthenticated` was wrong: with biometrics OFF the app shows the
  // main UI while `isAuthenticated` can still be false, so the prompt never
  // surfaced and the dApp's request auto-rejected after the 240s timeout.
  // The real question is only "is the lock screen currently covering us",
  // which is exactly `isBiometricEnabled && !isAuthenticated`.
  const locked = isBiometricEnabled && !isAuthenticated;

  useEffect(() => {
    if (step !== EStep.READY || booted.current) return;
    booted.current = true;
    void wcService.bootstrapIfHadSessions();
  }, [step]);

  useEffect(() => {
    const prompt = state.prompt;
    if (!prompt || locked || step !== EStep.READY) return;
    if (pushedFor.current === prompt) return;
    pushedFor.current = prompt;
    try {
      router.push('/WalletConnectApproveModal');
    } catch {
      // Navigator not ready for this route — reject rather than ghost it.
      prompt.resolve(false);
    }
  }, [state.prompt, locked, step]);

  return null;
}
