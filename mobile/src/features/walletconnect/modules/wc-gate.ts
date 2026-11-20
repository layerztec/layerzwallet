import { EStep } from '@shared/hooks/InitializationContext';

/**
 * Pure gate for surfacing a WalletConnect prompt (used by WcBootstrap).
 *
 * `isAuthenticated` is AuthStateContext's `finalIsAuthenticated`: true once
 * the app is READY and the user is past the biometric lock — or immediately
 * when biometrics are off — and false until settings have loaded. That is
 * exactly "the lock screen is not covering us", so nothing else needs to be
 * consulted. WcBootstrap MUST be mounted under AuthStateContextProvider:
 * with the context defaults (`isAuthenticated: false`) this gate never opens.
 */
export function shouldSurfacePrompt(hasPrompt: boolean, isAuthenticated: boolean, step: EStep): boolean {
  return hasPrompt && isAuthenticated && step === EStep.READY;
}
