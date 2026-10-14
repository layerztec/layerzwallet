import { useState, useEffect, useCallback, useRef } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { AppState, Alert } from 'react-native';
import { useSettings } from '@shared/hooks/useSettings';
import { useBiometrics } from '@/hooks/useBiometrics';

export interface AppLockState {
  isLocked: boolean;
  isAuthenticating: boolean;
  requiresAuth: boolean;
  userCanceled: boolean;
}

export const useAppLock = () => {
  const { settings } = useSettings();
  const biometricInfo = useBiometrics();
  const isAuthenticatingRef = useRef(false);
  const [lockState, setLockState] = useState<AppLockState>({
    isLocked: false,
    isAuthenticating: false,
    requiresAuth: false,
    userCanceled: false,
  });

  const isBiometricEnabled = (settings as any).biometricAuth === 'ON';

  useEffect(() => {
    if (isBiometricEnabled && biometricInfo.isAvailable) {
      const timeout = setTimeout(() => {
        setLockState((prev) => ({ ...prev, requiresAuth: true, isLocked: true, userCanceled: false }));
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [isBiometricEnabled, biometricInfo.isAvailable]);

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
        disableDeviceFallback: false,
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
