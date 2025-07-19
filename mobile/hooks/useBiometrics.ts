import { useState, useEffect } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export interface BiometricInfo {
  isAvailable: boolean;
  biometricType: 'FaceID' | 'TouchID' | 'Fingerprint' | 'Iris' | 'Biometrics' | null;
  displayName: string;
  description: string;
}

export const useBiometrics = (): BiometricInfo => {
  const [biometricInfo, setBiometricInfo] = useState<BiometricInfo>({
    isAvailable: false,
    biometricType: null,
    displayName: 'Biometrics',
    description: 'Use biometric authentication to secure your wallet.',
  });

  useEffect(() => {
    const checkBiometricCapabilities = async () => {
      try {
        const isAvailable = await LocalAuthentication.hasHardwareAsync();
        if (!isAvailable) {
          setBiometricInfo({
            isAvailable: false,
            biometricType: null,
            displayName: 'Biometrics',
            description: 'Biometric authentication is not available on this device.',
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
        });
      } catch (error) {
        console.error('Error checking biometric capabilities:', error);
        setBiometricInfo({
          isAvailable: false,
          biometricType: null,
          displayName: 'Biometrics',
          description: 'Unable to check biometric capabilities.',
        });
      }
    };

    checkBiometricCapabilities();
  }, []);

  return biometricInfo;
};
