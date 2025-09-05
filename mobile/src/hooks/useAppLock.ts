import { useState, useEffect, useCallback, useRef } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { AppState, Alert } from 'react-native';
import { useSettings } from '@shared/hooks/useSettings';
import { useBiometrics } from '@/hooks/useBiometrics';
import { useBiometricAuth } from '@/src/hooks/BiometricAuthContext';

export interface AppLockState {
  isLocked: boolean;
  isAuthenticating: boolean;
  requiresAuth: boolean;
  userCanceled: boolean;
}

export const useAppLock = () => {
  const { settings } = useSettings();
  const biometricInfo = useBiometrics();
  const { isUpdatingBiometric } = useBiometricAuth();
  const isAuthenticatingRef = useRef(false);
  const [lockState, setLockState] = useState<AppLockState>({
    isLocked: false,
    isAuthenticating: false,
    requiresAuth: false,
    userCanceled: false,
  });
  const [hasInitialized, setHasInitialized] = useState(false);

  const isBiometricEnabled = (settings as any).biometricAuth === 'ON';

  // Initialize lock state when settings and biometric info are available
  useEffect(() => {
    // Only initialize once, and only after we have biometric info
    if (!hasInitialized && biometricInfo.isAvailable !== undefined) {
      setHasInitialized(true);

      if (isBiometricEnabled && biometricInfo.isAvailable) {
        setLockState({
          isLocked: true,
          isAuthenticating: false,
          requiresAuth: true,
          userCanceled: false,
        });
      } else {
        setLockState({
          isLocked: false,
          isAuthenticating: false,
          requiresAuth: false,
          userCanceled: false,
        });
      }
    }

    // Handle changes after initialization
    if (hasInitialized && !isUpdatingBiometric) {
      if (isBiometricEnabled && biometricInfo.isAvailable) {
        setLockState((prev) => {
          // Only update if not already in correct state to prevent loops
          if (!prev.isLocked && !prev.requiresAuth) {
            return { ...prev, requiresAuth: true, isLocked: true, userCanceled: false };
          }
          return prev;
        });
      } else {
        // If biometrics are disabled, ensure we're unlocked
        setLockState((prev) => {
          if (prev.isLocked || prev.requiresAuth) {
            return { isLocked: false, isAuthenticating: false, requiresAuth: false, userCanceled: false };
          }
          return prev;
        });
      }
    }
  }, [isBiometricEnabled, biometricInfo.isAvailable, hasInitialized, isUpdatingBiometric]);

  const authenticateWithBiometrics = useCallback(async (): Promise<boolean> => {
    // Prevent multiple simultaneous authentication attempts
    if (isAuthenticatingRef.current || !biometricInfo.isAvailable) {
      if (!biometricInfo.isAvailable) {
        Alert.alert('Biometric Authentication Unavailable', biometricInfo.description);
      }
      return false;
    }

    isAuthenticatingRef.current = true;
    setLockState((prev) => ({ ...prev, isAuthenticating: true }));

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Layerz Wallet',
        fallbackLabel: 'Use Device PIN',
        disableDeviceFallback: false,
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        setLockState({
          isLocked: false,
          isAuthenticating: false,
          requiresAuth: false,
          userCanceled: false,
        });
        isAuthenticatingRef.current = false;
        return true;
      } else {
        setLockState((prev) => ({ ...prev, isAuthenticating: false, userCanceled: true }));
        isAuthenticatingRef.current = false;
        return false;
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      setLockState((prev) => ({ ...prev, isAuthenticating: false, userCanceled: true }));
      isAuthenticatingRef.current = false;
      return false;
    }
  }, [biometricInfo]);

  const lockApp = useCallback(() => {
    if (isBiometricEnabled && biometricInfo.isAvailable) {
      setLockState({
        isLocked: true,
        isAuthenticating: false,
        requiresAuth: true,
        userCanceled: false,
      });
      // Global modal overlay will handle unlock UI automatically
    }
  }, [isBiometricEnabled, biometricInfo.isAvailable]);

  const unlockApp = useCallback(() => {
    setLockState({
      isLocked: false,
      isAuthenticating: false,
      requiresAuth: false,
      userCanceled: false,
    });
  }, []);

  const clearCanceled = useCallback(() => {
    setLockState((prev) => ({ ...prev, userCanceled: false }));
  }, []);

  // Listen for app state changes to lock the app when backgrounded
  useEffect(() => {
    if (!isBiometricEnabled) return;

    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Lock the app when it goes to background
        lockApp();
      } else if (nextAppState === 'active') {
        // Reset userCanceled when app becomes active, but don't auto-authenticate
        setLockState((prevState) => {
          if (prevState.requiresAuth && prevState.userCanceled) {
            return { ...prevState, userCanceled: false };
          }
          return prevState;
        });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isBiometricEnabled, lockApp, authenticateWithBiometrics]);

  return {
    lockState,
    authenticateWithBiometrics,
    lockApp,
    unlockApp,
    clearCanceled,
    isBiometricEnabled,
    biometricInfo,
  };
};
