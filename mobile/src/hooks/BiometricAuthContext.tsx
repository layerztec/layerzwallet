import React, { createContext, ReactNode, useState, useCallback, useContext } from 'react';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { Alert } from 'react-native';
import { useBiometrics } from '../../hooks/useBiometrics';

/**
 * Checks if the app is running in Maestro test mode
 */
export const isMaestroMode = (): boolean => {
  // Check for Maestro environment variables or test indicators
  return !!(
    process.env.NODE_ENV === 'test' ||
    process.env.MAESTRO_TEST === 'true' ||
    process.env.EXPO_PUBLIC_MAESTRO === 'true' ||
    // @ts-ignore - Check for global test flag that might be set by Maestro
    global.__MAESTRO_MODE__
  );
};

interface IBiometricAuthContext {
  authenticateWithBiometrics: () => Promise<boolean>;
  handleBiometricAuthComplete: (success: boolean) => void;
  isAuthenticationRequired: boolean;
  setAuthenticationRequired: (required: boolean) => void;
}

export const BiometricAuthContext = createContext<IBiometricAuthContext>({
  authenticateWithBiometrics: (): Promise<boolean> => Promise.reject('authenticateWithBiometrics: this should never happen'),
  handleBiometricAuthComplete: (): void => {},
  isAuthenticationRequired: false,
  setAuthenticationRequired: (): void => {},
});

export const useBiometricAuth = () => {
  const context = useContext(BiometricAuthContext);
  if (!context) {
    throw new Error('useBiometricAuth must be used within BiometricAuthContextProvider');
  }
  return context;
};

type ResolverFunction = (resolveValue: boolean) => void;

/**
 * This provider provides biometric authentication functionality and manages app lock state.
 */
export const BiometricAuthContextProvider: React.FC<{ children: ReactNode }> = (props) => {
  const [resolverFunc, setResolverFunc] = useState<ResolverFunction>(() => () => {});
  const [isAuthenticationRequired, setAuthenticationRequired] = useState(false);
  const router = useRouter();
  const biometricInfo = useBiometrics();

  const authenticateWithBiometrics = useCallback(async (): Promise<boolean> => {
    if (!biometricInfo.isAvailable) {
      Alert.alert('Biometric Authentication Unavailable', biometricInfo.description);
      return false;
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Layerz Wallet',
        fallbackLabel: 'Use Device PIN',
        disableDeviceFallback: false,
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return false;
    }
  }, [biometricInfo]);

  const authenticateAndNavigate = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      setResolverFunc(() => resolve);
      setAuthenticationRequired(true);
      router.push('/BiometricAuth');
    });
  }, [router]);

  const handleBiometricAuthComplete = useCallback(
    (success: boolean) => {
      resolverFunc(success);
      setResolverFunc(() => () => {});
      setAuthenticationRequired(false);
    },
    [resolverFunc]
  );

  return (
    <BiometricAuthContext.Provider
      value={{
        authenticateWithBiometrics: authenticateAndNavigate,
        handleBiometricAuthComplete,
        isAuthenticationRequired,
        setAuthenticationRequired,
      }}
    >
      {props.children}
    </BiometricAuthContext.Provider>
  );
};
