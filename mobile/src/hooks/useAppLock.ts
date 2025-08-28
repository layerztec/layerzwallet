import { useState, useEffect, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { AppState, Alert } from 'react-native';
import { useSettings } from '@shared/hooks/useSettings';
import { useBiometrics } from '@/hooks/useBiometrics';

export interface AppLockState {
  isLocked: boolean;
  isAuthenticating: boolean;
  requiresAuth: boolean;
}

export const useAppLock = () => {
  const { settings } = useSettings();
  const biometricInfo = useBiometrics();
  const [lockState, setLockState] = useState<AppLockState>({
    isLocked: false,
    isAuthenticating: false,
    requiresAuth: false,
  });

  const isBiometricEnabled = (settings as any).biometricAuth === 'ON';

  useEffect(() => {
    if (isBiometricEnabled && biometricInfo.isAvailable) {
      setLockState((prev) => ({ ...prev, requiresAuth: true, isLocked: true }));
    }
  }, [isBiometricEnabled, biometricInfo.isAvailable]);

  const authenticateWithBiometrics = useCallback(async (): Promise<boolean> => {
    if (!biometricInfo.isAvailable) {
      Alert.alert('Biometric Authentication Unavailable', biometricInfo.description);
      return false;
    }

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
        });
        return true;
      } else {
        setLockState((prev) => ({ ...prev, isAuthenticating: false }));
        return false;
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      setLockState((prev) => ({ ...prev, isAuthenticating: false }));
      return false;
    }
  }, [biometricInfo]);

  const lockApp = useCallback(() => {
    if (isBiometricEnabled && biometricInfo.isAvailable) {
      setLockState({
        isLocked: true,
        isAuthenticating: false,
        requiresAuth: true,
      });
    }
  }, [isBiometricEnabled, biometricInfo.isAvailable]);

  const unlockApp = useCallback(() => {
    setLockState({
      isLocked: false,
      isAuthenticating: false,
      requiresAuth: false,
    });
  }, []);

  // Listen for app state changes to lock the app when backgrounded
  useEffect(() => {
    if (!isBiometricEnabled) return;

    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Lock the app when it goes to background
        lockApp();
      } else if (nextAppState === 'active' && lockState.requiresAuth) {
        // When app becomes active and requires auth, trigger authentication
        authenticateWithBiometrics();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isBiometricEnabled, lockState.requiresAuth, lockApp, authenticateWithBiometrics]);

  return {
    lockState,
    authenticateWithBiometrics,
    lockApp,
    unlockApp,
    isBiometricEnabled,
    biometricInfo,
  };
};
