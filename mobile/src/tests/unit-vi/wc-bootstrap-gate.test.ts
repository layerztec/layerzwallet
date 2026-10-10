import { describe, expect, it } from 'vitest';

import { EStep } from '@shared/hooks/InitializationContext';
import { shouldSurfacePrompt } from '../../features/walletconnect/modules/wc-gate';

// Regression guard for the review finding that the consent gate sat outside
// AuthStateContextProvider: with the context defaults it must stay CLOSED
// (never approvable over the biometric lock), and it must open as soon as
// the real unlock state says so.
describe('WcBootstrap gate (shouldSurfacePrompt)', () => {
  it('stays closed with the AuthStateContext defaults (isAuthenticated=false)', () => {
    expect(shouldSurfacePrompt(true, false, EStep.READY)).toBe(false);
  });

  it('stays closed before initialization reaches READY', () => {
    expect(shouldSurfacePrompt(true, true, EStep.UNLOCK_PASSWORD)).toBe(false);
    expect(shouldSurfacePrompt(true, true, EStep.LOADING)).toBe(false);
  });

  it('opens once READY and unlocked (biometrics off → authenticated at init; on → after unlock)', () => {
    expect(shouldSurfacePrompt(true, true, EStep.READY)).toBe(true);
  });

  it('closes again on re-lock (background with biometrics on)', () => {
    expect(shouldSurfacePrompt(true, false, EStep.READY)).toBe(false);
  });

  it('never opens without a prompt', () => {
    expect(shouldSurfacePrompt(false, true, EStep.READY)).toBe(false);
  });
});
