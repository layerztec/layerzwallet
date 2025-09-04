import React, { useEffect, useState, useContext, useCallback } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { useBiometricAuth } from '@/src/hooks/BiometricAuthContext';
import { useBiometrics } from '@/hooks/useBiometrics';
import GradientScreen from '@/components/GradientScreen';
import { NetworkContext } from '@shared/hooks/NetworkContext';

export default function BiometricAuthScreen() {
  const router = useRouter();
  const { authenticateWithBiometrics, handleBiometricAuthComplete } = useBiometricAuth();
  const biometricInfo = useBiometrics();
  const { network } = useContext(NetworkContext);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const performAuthentication = useCallback(async () => {
    if (isAuthenticating) return;

    setIsAuthenticating(true);

    try {
      const success = await authenticateWithBiometrics();
      if (success) {
        handleBiometricAuthComplete(true);
        router.back();
      } else {
        setIsAuthenticating(false);
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setIsAuthenticating(false);
      Alert.alert('Authentication Error', 'Failed to authenticate. Please try again.');
    }
  }, [isAuthenticating, authenticateWithBiometrics, handleBiometricAuthComplete, router]);

  useEffect(() => {
    performAuthentication();
  }, [performAuthentication]);

  const handleAuthenticate = () => {
    performAuthentication();
  };

  const handleCancel = () => {
    handleBiometricAuthComplete(false);
    router.back();
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

          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} disabled={isAuthenticating}>
            <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
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
    marginBottom: 32,
    padding: 20,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 48,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 22,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
  },
});
