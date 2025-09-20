import { useState, useEffect } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export interface BiometricInfo {
  isAvailable: boolean;
  biometricType: 'FaceID' | 'TouchID' | 'Fingerprint' | 'Iris' | 'Biometrics' | null;
  displayName: string;
  description: string;
  isLoading: boolean;
}

export const useBiometrics = (): BiometricInfo => {
  const [biometricInfo, setBiometricInfo] = useState<BiometricInfo>({
    isAvailable: false,
    biometricType: null,
    displayName: 'Biometrics',
    description: 'Use biometric authentication to secure your wallet.',
    isLoading: true,
  });

  useEffect(() => {
    const checkBiometricCapabilities = async (retryCount = 0) => {
      try {
        // Add a small delay during cold boot to ensure hardware is ready
        if (retryCount === 0) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        const isAvailable = await LocalAuthentication.hasHardwareAsync();

        if (!isAvailable) {
          // During cold boot, hardware might not be immediately available
          // Retry up to 3 times with increasing delays
          if (retryCount < 3) {
            setTimeout(() => checkBiometricCapabilities(retryCount + 1), (retryCount + 1) * 1000);
            return;
          }

          setBiometricInfo({
            isAvailable: false,
            biometricType: null,
            displayName: 'Biometrics',
            description: 'Biometric authentication is not available on this device.',
            isLoading: false,
          });
          return;
        }

        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (!isEnrolled) {
          setBiometricInfo({
            isAvailable: false,
            biometricType: null,
            displayName: 'Biometrics',
            description: 'No biometric authentication methods are set up on this device.',
            isLoading: false,
          });
          return;
        }

        const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

        let biometricType: BiometricInfo['biometricType'] = null;

        if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          biometricType = Platform.OS === 'ios' ? 'FaceID' : 'Biometrics';
        } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          biometricType = Platform.OS === 'ios' ? 'TouchID' : 'Fingerprint';
        } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
          biometricType = 'Iris';
        } else if (supportedTypes.length > 0) {
          biometricType = 'Biometrics';
        }

        const getBiometricDisplayInfo = (type: BiometricInfo['biometricType']) => {
          switch (type) {
            case 'FaceID':
              return { displayName: 'Face ID', description: 'Use Face ID to secure your wallet access.' };
            case 'TouchID':
              return { displayName: 'Touch ID', description: 'Use Touch ID to secure your wallet access.' };
            case 'Fingerprint':
              return { displayName: 'Fingerprint', description: 'Use fingerprint authentication to secure your wallet access.' };
            case 'Iris':
              return { displayName: 'Iris Scan', description: 'Use iris scanning to secure your wallet access.' };
            case 'Biometrics':
              return {
                displayName: Platform.OS === 'ios' ? 'Biometrics' : 'Face Recognition',
                description: Platform.OS === 'ios' ? 'Use biometric authentication to secure your wallet access.' : 'Use face recognition to secure your wallet access.',
              };
            default:
              return { displayName: 'Biometrics', description: 'Use biometric authentication to secure your wallet.' };
          }
        };

        const { displayName, description } = getBiometricDisplayInfo(biometricType);

        setBiometricInfo({
          isAvailable: biometricType !== null,
          biometricType,
          displayName,
          description,
          isLoading: false,
        });
      } catch (error) {
        // During cold boot, API calls might fail temporarily
        // Retry up to 3 times with increasing delays
        if (retryCount < 3) {
          setTimeout(() => checkBiometricCapabilities(retryCount + 1), (retryCount + 1) * 1000);
          return;
        }

        setBiometricInfo({
          isAvailable: false,
          biometricType: null,
          displayName: 'Biometrics',
          description: 'Unable to check biometric capabilities.',
          isLoading: false,
        });
      }
    };

    checkBiometricCapabilities();
  }, []);

  return biometricInfo;
};
