import React, { useEffect, useState, useCallback, useContext } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { useAuthState } from '@/src/hooks/AuthStateContext';
import { useBiometrics } from '@/hooks/useBiometrics';
import GradientScreen from '@/components/GradientScreen';
import { NetworkContext } from '@shared/hooks/NetworkContext';

export default function BiometricLoginScreen() {
  const { authenticateWithBiometrics } = useAuthState();
  const biometricInfo = useBiometrics();
  const { network } = useContext(NetworkContext);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [hasTriedInitialAuth, setHasTriedInitialAuth] = useState(false);

  const performAuthentication = useCallback(
    async (isInitialAuth = false) => {
      if (isAuthenticating) return;

      setIsAuthenticating(true);

      try {
        const success = await authenticateWithBiometrics();
        if (!success) {
          setIsAuthenticating(false);
          // Only set hasTriedInitialAuth to true after the first authentication attempt completes
          if (isInitialAuth) {
            setHasTriedInitialAuth(true);
          }
        }
      } catch (error) {
        setIsAuthenticating(false);
        // Only set hasTriedInitialAuth to true after the first authentication attempt completes
        if (isInitialAuth) {
          setHasTriedInitialAuth(true);
        }
        Alert.alert('Authentication Error', 'Failed to authenticate. Please try again.');
      }
    },
    [isAuthenticating, authenticateWithBiometrics]
  );

  useEffect(() => {
    if (!hasTriedInitialAuth && !biometricInfo.isLoading && biometricInfo.isAvailable) {
      // Add a small delay to ensure the screen is fully mounted and biometric hardware is ready
      setTimeout(() => {
        performAuthentication(true); // Pass true to indicate this is the initial auth
      }, 500);
    }
  }, [performAuthentication, hasTriedInitialAuth, biometricInfo.isLoading, biometricInfo.isAvailable]);

  const handleAuthenticate = () => {
    performAuthentication(false); // Pass false for manual authentication
  };

  const getBiometricIcon = () => {
    if (!biometricInfo.isAvailable || !biometricInfo.biometricType) {
      return 'security';
    }

    switch (biometricInfo.biometricType) {
      case 'FaceID':
        return 'face';
      case 'TouchID':
      case 'Fingerprint':
        return 'fingerprint';
      default:
        return 'security';
    }
  };

  const getBiometricText = () => {
    if (!biometricInfo.isAvailable || !biometricInfo.biometricType) {
      return 'Use biometric authentication to unlock your wallet';
    }

    return biometricInfo.displayName ? `Use ${biometricInfo.displayName} to unlock your wallet` : 'Use biometric authentication to unlock your wallet';
  };

  const getButtonText = () => {
    if (isAuthenticating) return 'Authenticating...';
    if (hasTriedInitialAuth) return 'Try Again';

    if (biometricInfo.biometricType === 'FaceID') return 'Use Face ID';
    if (biometricInfo.biometricType === 'TouchID') return 'Use Touch ID';
    if (biometricInfo.biometricType === 'Fingerprint') return 'Use Fingerprint';

    return 'Unlock';
  };

  return (
    <GradientScreen variant={network}>
      <View style={[styles.container, { backgroundColor: 'transparent' }]}>
        {biometricInfo.isLoading ? (
          <ActivityIndicator size="large" color="rgba(255, 255, 255, 0.8)" />
        ) : (
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <MaterialIcons name={getBiometricIcon() as any} size={80} color="rgba(255, 255, 255, 0.8)" />
            </View>

            <ThemedText style={styles.title}>Unlock Layerz Wallet</ThemedText>

            <ThemedText style={styles.subtitle}>{getBiometricText()}</ThemedText>

            {(hasTriedInitialAuth || !biometricInfo.isAvailable) && (
              <TouchableOpacity style={styles.retryButton} onPress={handleAuthenticate} disabled={isAuthenticating}>
                <MaterialIcons name="refresh" size={24} color="rgba(255, 255, 255, 0.8)" />
                <ThemedText style={styles.retryButtonText}>{getButtonText()}</ThemedText>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  content: {
    alignItems: 'center',
    maxWidth: 300,
  },
  iconContainer: {
    marginBottom: 30,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 22,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 20,
  },
  retryButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
});
