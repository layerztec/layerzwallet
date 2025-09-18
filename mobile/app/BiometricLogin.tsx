import React, { useEffect, useState, useCallback, useContext } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity } from 'react-native';
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

  const performAuthentication = useCallback(async () => {
    if (isAuthenticating) return;

    setIsAuthenticating(true);

    try {
      const success = await authenticateWithBiometrics();
      if (!success) {
        setIsAuthenticating(false);
      }
      // If successful, the auth state will change and this screen will be unmounted
    } catch (error) {
      console.error('Authentication error:', error);
      setIsAuthenticating(false);
      Alert.alert('Authentication Error', 'Failed to authenticate. Please try again.');
    }
  }, [isAuthenticating, authenticateWithBiometrics]);

  // Auto-trigger authentication when screen loads
  useEffect(() => {
    if (!hasTriedInitialAuth) {
      setHasTriedInitialAuth(true);
      // Trigger immediately when screen loads
      performAuthentication();
    }
  }, [performAuthentication, hasTriedInitialAuth]);

  const handleAuthenticate = () => {
    performAuthentication();
  };

  const getBiometricIcon = () => {
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

  return (
    <GradientScreen variant={network}>
      <View style={[styles.container, { backgroundColor: 'transparent' }]}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <MaterialIcons name={getBiometricIcon() as any} size={80} color="rgba(255, 255, 255, 0.8)" />
          </View>

          <ThemedText style={styles.title}>Unlock Layerz Wallet</ThemedText>

          <ThemedText style={styles.subtitle}>{biometricInfo.displayName ? `Use ${biometricInfo.displayName} to unlock your wallet` : 'Use biometric authentication to unlock your wallet'}</ThemedText>

          <TouchableOpacity style={styles.retryButton} onPress={handleAuthenticate} disabled={isAuthenticating}>
            <MaterialIcons name="refresh" size={24} color="rgba(255, 255, 255, 0.8)" />
            <ThemedText style={styles.retryButtonText}>{isAuthenticating ? 'Authenticating...' : 'Try Again'}</ThemedText>
          </TouchableOpacity>
        </View>
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
