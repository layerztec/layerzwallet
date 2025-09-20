import React, { createContext, ReactNode, useState, useCallback, useContext } from 'react';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { Alert } from 'react-native';
import { useBiometrics } from '../../hooks/useBiometrics';
import { useSettings } from '@shared/hooks/useSettings';

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
  enableBiometricAuth: () => Promise<boolean>;
  disableBiometricAuth: () => Promise<boolean>;
  isBiometricEnabled: boolean;
  isUpdatingBiometric: boolean;
}

export const BiometricAuthContext = createContext<IBiometricAuthContext>({
  authenticateWithBiometrics: (): Promise<boolean> => Promise.reject('authenticateWithBiometrics: this should never happen'),
  handleBiometricAuthComplete: (): void => {},
  isAuthenticationRequired: false,
  setAuthenticationRequired: (): void => {},
  enableBiometricAuth: (): Promise<boolean> => Promise.reject('enableBiometricAuth: this should never happen'),
  disableBiometricAuth: (): Promise<boolean> => Promise.reject('disableBiometricAuth: this should never happen'),
  isBiometricEnabled: false,
  isUpdatingBiometric: false,
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
  const [isUpdatingBiometric, setIsUpdatingBiometric] = useState(false);
  const router = useRouter();
  const biometricInfo = useBiometrics();
  const { settings, updateSetting } = useSettings();

  const isBiometricEnabled = settings.biometricAuth === 'ON';

  const authenticateWithBiometrics = useCallback(async (): Promise<boolean> => {
    // Don't show unavailable alert if biometrics are still being checked
    if (!biometricInfo.isAvailable) {
      console.log('🔐 BiometricAuth: Biometrics not available:', biometricInfo.description);
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

  const enableBiometricAuth = useCallback(async (): Promise<boolean> => {
    if (isUpdatingBiometric) {
      return false;
    }

    setIsUpdatingBiometric(true);

    try {
      // Check if we're in test/Maestro mode
      if (isMaestroMode()) {
        return new Promise((resolve) => {
          Alert.alert('Biometric Authentication', 'Simulating successful biometric setup for testing', [
            {
              text: 'OK',
              onPress: async () => {
                await updateSetting('biometricAuth', 'ON');
                setIsUpdatingBiometric(false);
                resolve(true);
              },
            },
          ]);
        });
      }

      // Check if biometrics are available
      if (!biometricInfo.isAvailable) {
        return new Promise((resolve) => {
          Alert.alert('Biometric Authentication Unavailable', biometricInfo.description, [
            {
              text: 'OK',
              onPress: () => {
                setIsUpdatingBiometric(false);
                resolve(false);
              },
            },
          ]);
        });
      }

      // Show confirmation dialog for enabling biometrics
      return new Promise((resolve) => {
        Alert.alert('Enable Biometric Authentication', `Use ${biometricInfo.displayName} to unlock your wallet?`, [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              setIsUpdatingBiometric(false);
              resolve(false);
            },
          },
          {
            text: 'Enable',
            onPress: async () => {
              await updateSetting('biometricAuth', 'ON');
              setIsUpdatingBiometric(false);
              resolve(true);
            },
          },
        ]);
      });
    } catch (error) {
      console.error('Error enabling biometric auth:', error);
      setIsUpdatingBiometric(false);
      return false;
    }
  }, [biometricInfo, isUpdatingBiometric, updateSetting]);

  const disableBiometricAuth = useCallback(async (): Promise<boolean> => {
    if (isUpdatingBiometric) {
      return false;
    }

    setIsUpdatingBiometric(true);

    try {
      // Check if we're in test/Maestro mode
      if (isMaestroMode()) {
        return new Promise((resolve) => {
          Alert.alert('Biometric Authentication', 'Simulating successful biometric disable for testing', [
            {
              text: 'OK',
              onPress: async () => {
                await updateSetting('biometricAuth', 'OFF');
                setIsUpdatingBiometric(false);
                resolve(true);
              },
            },
          ]);
        });
      }

      // Check if biometrics are available
      if (!biometricInfo.isAvailable) {
        return new Promise((resolve) => {
          Alert.alert('Biometric Authentication Unavailable', biometricInfo.description, [
            {
              text: 'OK',
              onPress: () => {
                setIsUpdatingBiometric(false);
                resolve(false);
              },
            },
          ]);
        });
      }

      // Require biometric authentication before disabling
      return new Promise((resolve) => {
        Alert.alert('Disable Biometric Authentication', `Please authenticate with ${biometricInfo.displayName} to disable this feature.`, [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              setIsUpdatingBiometric(false);
              resolve(false);
            },
          },
          {
            text: 'Authenticate',
            onPress: async () => {
              // Perform biometric authentication
              try {
                const authResult = await LocalAuthentication.authenticateAsync({
                  promptMessage: 'Authenticate to disable biometric unlock',
                  fallbackLabel: 'Use Device PIN',
                  disableDeviceFallback: false,
                  cancelLabel: 'Cancel',
                });

                if (authResult.success) {
                  await updateSetting('biometricAuth', 'OFF');
                  setIsUpdatingBiometric(false);
                  resolve(true);
                } else {
                  setIsUpdatingBiometric(false);
                  resolve(false);
                }
              } catch (error) {
                console.error('Error authenticating to disable biometric auth:', error);
                setIsUpdatingBiometric(false);
                resolve(false);
              }
            },
          },
        ]);
      });
    } catch (error) {
      console.error('Error disabling biometric auth:', error);
      setIsUpdatingBiometric(false);
      return false;
    }
  }, [biometricInfo, isUpdatingBiometric, updateSetting]);

  return (
    <BiometricAuthContext.Provider
      value={{
        authenticateWithBiometrics: authenticateAndNavigate,
        handleBiometricAuthComplete,
        isAuthenticationRequired,
        setAuthenticationRequired,
        enableBiometricAuth,
        disableBiometricAuth,
        isBiometricEnabled,
        isUpdatingBiometric,
      }}
    >
      {props.children}
    </BiometricAuthContext.Provider>
  );
};
