import React, { createContext, ReactNode, useContext, useEffect, useState, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { AppState, AppStateStatus, Linking } from 'react-native';
import { SecureStorage } from '@/src/class/secure-storage';

const STORAGE_KEY_SECURITY_ENABLED = 'STORAGE_KEY_SECURITY_ENABLED';
const STORAGE_KEY_LOCK_ON_BACKGROUND = 'STORAGE_KEY_LOCK_ON_BACKGROUND';

export interface SecurityContextType {
  isAppLocked: boolean;
  isSecurityEnabled: boolean;
  isAuthenticationAvailable: boolean;
  authenticationTypes: LocalAuthentication.AuthenticationType[];
  biometricType: 'FaceID' | 'TouchID' | 'Fingerprint' | 'Iris' | 'Biometrics' | null;
  unlockApp: () => Promise<{ success: boolean; error?: string; cancelled?: boolean }>;
  lockApp: () => void;
  enableSecurity: () => Promise<boolean>;
  disableSecurity: () => Promise<void>;
  hasSecurityMismatch: boolean;
  checkSecurityAvailability: () => Promise<void>;
  lockOnBackground: boolean;
  setLockOnBackground: (enabled: boolean) => Promise<void>;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const useSecurityContext = (): SecurityContextType => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurityContext must be used within a SecurityContextProvider');
  }
  return context;
};

interface Props {
  children: ReactNode;
}

export const SecurityContextProvider: React.FC<Props> = ({ children }) => {
  const [isAppLocked, setIsAppLocked] = useState(true);
  const [isSecurityEnabled, setIsSecurityEnabled] = useState(false);
  const [isAuthenticationAvailable, setIsAuthenticationAvailable] = useState(false);
  const [authenticationTypes, setAuthenticationTypes] = useState<LocalAuthentication.AuthenticationType[]>([]);
  const [biometricType, setBiometricType] = useState<SecurityContextType['biometricType']>(null);
  const [hasSecurityMismatch, setHasSecurityMismatch] = useState(false);
  const [lockOnBackground, setLockOnBackgroundState] = useState(true);

  const checkSecurityAvailability = useCallback(async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

      const available = hasHardware && isEnrolled && supportedTypes.length > 0;
      setIsAuthenticationAvailable(available);
      setAuthenticationTypes(supportedTypes);

      if (available) {
        let detectedType: SecurityContextType['biometricType'] = null;

        if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          detectedType = 'FaceID';
        } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          detectedType = 'TouchID';
        } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
          detectedType = 'Iris';
        } else {
          detectedType = 'Biometrics';
        }

        setBiometricType(detectedType);
      } else {
        setBiometricType(null);
      }

      if (isSecurityEnabled && !available) {
        setHasSecurityMismatch(true);
      } else {
        setHasSecurityMismatch(false);
      }
    } catch (error) {
      console.error('Error checking security availability:', error);
      setIsAuthenticationAvailable(false);
      setAuthenticationTypes([]);
      setBiometricType(null);
    }
  }, [isSecurityEnabled]);

  const initializeSecurity = useCallback(async () => {
    try {
      const securityEnabled = await SecureStorage.getItem(STORAGE_KEY_SECURITY_ENABLED);
      const enabled = securityEnabled === 'true';
      setIsSecurityEnabled(enabled);

      const lockOnBg = await SecureStorage.getItem(STORAGE_KEY_LOCK_ON_BACKGROUND);
      const lockOnBgEnabled = lockOnBg !== 'false';
      setLockOnBackgroundState(lockOnBgEnabled);

      await checkSecurityAvailability();

      if (enabled) {
        setIsAppLocked(true);
      } else {
        setIsAppLocked(false);
      }
    } catch (error) {
      console.error('Error initializing security:', error);
      setIsAppLocked(false);
    }
  }, [checkSecurityAvailability]);

  const lockApp = useCallback(() => {
    if (isSecurityEnabled) {
      setIsAppLocked(true);
    }
  }, [isSecurityEnabled]);

  const unlockApp = useCallback(async (): Promise<{ success: boolean; error?: string; cancelled?: boolean }> => {
    try {
      if (!isSecurityEnabled) {
        setIsAppLocked(false);
        return { success: true };
      }

      if (!isAuthenticationAvailable) {
        return { success: false, error: 'Device authentication is not available' };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Layerz Wallet',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Device Passcode',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsAppLocked(false);
        return { success: true };
      }

      if (result.error === 'user_cancel' || result.error === 'app_cancel' || result.error === 'system_cancel') {
        return { success: false, cancelled: true };
      } else if (result.error === 'not_available') {
        return { success: false, error: 'Biometric authentication is not available' };
      } else if (result.error === 'passcode_not_set') {
        return { success: false, error: 'Device passcode is not set' };
      } else if (result.error === 'not_enrolled') {
        return { success: false, error: 'No biometric authentication is enrolled on this device' };
      } else if (result.error === 'lockout') {
        return { success: false, error: 'Authentication is temporarily locked due to too many failed attempts' };
      } else if (result.error === 'timeout') {
        return { success: false, error: 'Authentication timed out. Please try again.' };
      } else if (result.error === 'user_fallback') {
        return { success: false, error: 'User chose to use fallback authentication' };
      }

      return { success: false, error: 'Authentication failed' };
    } catch (error) {
      console.error('Error during unlock:', error);
      return { success: false, error: 'An unexpected error occurred during authentication' };
    }
  }, [isSecurityEnabled, isAuthenticationAvailable]);

  const enableSecurity = useCallback(async (): Promise<boolean> => {
    try {
      if (!isAuthenticationAvailable) {
        return false;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable security for Layerz Wallet',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Device Passcode',
        disableDeviceFallback: false,
      });

      if (result.success) {
        await SecureStorage.setItem(STORAGE_KEY_SECURITY_ENABLED, 'true');
        setIsSecurityEnabled(true);
        setIsAppLocked(true);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error enabling security:', error);
      return false;
    }
  }, [isAuthenticationAvailable]);

  const disableSecurity = useCallback(async (): Promise<void> => {
    try {
      await SecureStorage.setItem(STORAGE_KEY_SECURITY_ENABLED, 'false');
      setIsSecurityEnabled(false);
      setIsAppLocked(false);
      setHasSecurityMismatch(false);
    } catch (error) {
      console.error('Error disabling security:', error);
    }
  }, []);

  const setLockOnBackground = useCallback(async (enabled: boolean): Promise<void> => {
    try {
      await SecureStorage.setItem(STORAGE_KEY_LOCK_ON_BACKGROUND, enabled.toString());
      setLockOnBackgroundState(enabled);
    } catch (error) {
      console.error('Error setting lock on background:', error);
    }
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if ((nextAppState === 'background' || nextAppState === 'inactive') && lockOnBackground) {
        lockApp();
      } else if (nextAppState === 'active') {
        checkSecurityAvailability();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [lockApp, checkSecurityAvailability, lockOnBackground]);

  useEffect(() => {
    initializeSecurity();
  }, [initializeSecurity]);

  const contextValue: SecurityContextType = {
    isAppLocked,
    isSecurityEnabled,
    isAuthenticationAvailable,
    authenticationTypes,
    biometricType,
    unlockApp,
    lockApp,
    enableSecurity,
    disableSecurity,
    hasSecurityMismatch,
    checkSecurityAvailability,
    lockOnBackground,
    setLockOnBackground,
  };

  return <SecurityContext.Provider value={contextValue}>{children}</SecurityContext.Provider>;
};
