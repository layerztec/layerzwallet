import React, { createContext, ReactNode, useState, useCallback, useContext, useEffect } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { Alert, AppState, AppStateStatus } from 'react-native';
import { useBiometrics } from '../../hooks/useBiometrics';
import { useSettings } from '@shared/hooks/useSettings';
import { EStep, InitializationContext } from '@shared/hooks/InitializationContext';

/**
 * Checks if the app is running in Maestro test mode
 */
export const isMaestroMode = (): boolean => {
  return !!(
    process.env.NODE_ENV === 'test' ||
    process.env.MAESTRO_TEST === 'true' ||
    process.env.EXPO_PUBLIC_MAESTRO === 'true' ||
    // @ts-ignore - Check for global test flag that might be set by Maestro
    global.__MAESTRO_MODE__
  );
};

interface IAuthState {
  isAuthenticated: boolean;
  isInitialized: boolean;
  isBiometricEnabled: boolean;
  isUpdatingBiometric: boolean;
  authenticateWithBiometrics: () => Promise<LocalAuthentication.LocalAuthenticationResult>;
  enableBiometricAuth: () => Promise<boolean>;
  disableBiometricAuth: () => Promise<boolean>;
  lockApp: () => void;
}

export const AuthStateContext = createContext<IAuthState>({
  isAuthenticated: false,
  isInitialized: false,
  isBiometricEnabled: false,
  isUpdatingBiometric: false,
  authenticateWithBiometrics: (): Promise<LocalAuthentication.LocalAuthenticationResult> => Promise.reject('authenticateWithBiometrics: this should never happen'),
  enableBiometricAuth: (): Promise<boolean> => Promise.reject('enableBiometricAuth: this should never happen'),
  disableBiometricAuth: (): Promise<boolean> => Promise.reject('disableBiometricAuth: this should never happen'),
  lockApp: (): void => {},
});

export const useAuthState = () => {
  const context = useContext(AuthStateContext);
  if (!context) {
    throw new Error('useAuthState must be used within AuthStateContextProvider');
  }
  return context;
};

/**
 * This provider manages the authentication state for protected routes.
 */
export const AuthStateContextProvider: React.FC<{ children: ReactNode }> = (props) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isUpdatingBiometric, setIsUpdatingBiometric] = useState(false);
  const [hasInitializedAuth, setHasInitializedAuth] = useState(false);
  const biometricInfo = useBiometrics();
  const { settings, updateSetting, isSettingsLoaded } = useSettings();
  const { step } = useContext(InitializationContext);

  const isBiometricEnabled = settings.biometricAuth === 'ON';
  const isInitialized = step === EStep.READY;

  // Auto-lock the app when it goes to background
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Don't auto-lock if we're currently updating biometric settings
        if (isBiometricEnabled && isAuthenticated && !isUpdatingBiometric) {
          setIsAuthenticated(false);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isBiometricEnabled, isAuthenticated, isUpdatingBiometric]);

  // Set initial authentication state based on biometric settings (only once)
  useEffect(() => {
    if (isInitialized && isSettingsLoaded && !hasInitializedAuth) {
      setHasInitializedAuth(true);

      // Capture the biometric setting at initialization time
      const biometricEnabledAtInit = settings.biometricAuth === 'ON';

      if (biometricEnabledAtInit) {
        // If biometrics are enabled, start unauthenticated
        setIsAuthenticated(false);
      } else {
        // If biometrics are disabled, start authenticated (no auth required)
        setIsAuthenticated(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, isSettingsLoaded, hasInitializedAuth]);

  const authenticateWithBiometrics = useCallback(async (): Promise<LocalAuthentication.LocalAuthenticationResult> => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Layerz Wallet',
        disableDeviceFallback: false,
        requireConfirmation: false,
        biometricsSecurityLevel: 'strong',
      });

      if (result.success) {
        setIsAuthenticated(true);
      }

      return result;
    } catch (error) {
      console.error('BiometricAuth: Authentication error:', error);
      return {
        success: false,
        error: 'unknown',
      };
    }
  }, []);

  const enableBiometricAuth = async (): Promise<boolean> => {
    if (isUpdatingBiometric) {
      return false;
    }

    setIsUpdatingBiometric(true);

    try {
      // Check if we're in test/Maestro mode
      if (isMaestroMode()) {
        await updateSetting('biometricAuth', 'ON');
        setIsUpdatingBiometric(false);
        return true;
      }

      if (!biometricInfo.isAvailable) {
        setIsUpdatingBiometric(false);
        Alert.alert('Biometric Authentication Unavailable', biometricInfo.description);
        return false;
      }

      // Directly trigger device biometric UI to confirm enabling
      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: `Enable ${biometricInfo.displayName} to unlock your wallet?`,
        disableDeviceFallback: false,
        requireConfirmation: false,
        // Use strong biometrics on Android for wallet security
        biometricsSecurityLevel: 'strong',
      });

      if (authResult.success) {
        await updateSetting('biometricAuth', 'ON');
        setIsUpdatingBiometric(false);
        return true;
      } else {
        setIsUpdatingBiometric(false);
        return false;
      }
    } catch (error) {
      setIsUpdatingBiometric(false);
      return false;
    }
  };

  const disableBiometricAuth = async (): Promise<boolean> => {
    if (isUpdatingBiometric) {
      return false;
    }

    setIsUpdatingBiometric(true);

    try {
      // Check if we're in test/Maestro mode
      if (isMaestroMode()) {
        await updateSetting('biometricAuth', 'OFF');
        setIsUpdatingBiometric(false);
        setIsAuthenticated(true); // User stays authenticated when disabling biometrics
        return true;
      }

      // Check if biometrics are available
      if (!biometricInfo.isAvailable) {
        setIsUpdatingBiometric(false);
        Alert.alert('Biometric Authentication Unavailable', biometricInfo.description);
        return false;
      }

      // Directly trigger device biometric UI to confirm disabling
      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: `Authenticate with ${biometricInfo.displayName} to disable biometric unlock`,
        disableDeviceFallback: false,
        requireConfirmation: false,
        biometricsSecurityLevel: 'strong',
      });

      if (authResult.success) {
        await updateSetting('biometricAuth', 'OFF');
        setIsUpdatingBiometric(false);
        setIsAuthenticated(true); // User stays authenticated when disabling biometrics
        return true;
      } else {
        setIsUpdatingBiometric(false);
        return false;
      }
    } catch (error) {
      setIsUpdatingBiometric(false);
      return false;
    }
  };

  const lockApp = useCallback(() => {
    setIsAuthenticated(false);
  }, []);

  const finalIsAuthenticated = isInitialized && isAuthenticated;

  return (
    <AuthStateContext.Provider
      value={{
        isAuthenticated: finalIsAuthenticated,
        isInitialized,
        isBiometricEnabled,
        isUpdatingBiometric,
        authenticateWithBiometrics,
        enableBiometricAuth,
        disableBiometricAuth,
        lockApp,
      }}
    >
      {props.children}
    </AuthStateContext.Provider>
  );
};
