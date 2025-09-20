import React, { useEffect, useState, useCallback, useContext, useRef } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, ActivityIndicator, Image, Linking, AppState, AppStateStatus } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { useAuthState } from '@/src/hooks/AuthStateContext';
import { useBiometrics } from '@/hooks/useBiometrics';
import GradientScreen from '@/components/GradientScreen';
import { NetworkContext } from '@shared/hooks/NetworkContext';

export default function BiometricLoginScreen() {
  const { authenticateWithBiometrics, isBiometricEnabled, disableBiometricAuth } = useAuthState();
  const biometricInfo = useBiometrics();
  const { network } = useContext(NetworkContext);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [hasTriedInitialAuth, setHasTriedInitialAuth] = useState(false);
  const appState = useRef(AppState.currentState);
  const lastAuthAttempt = useRef<number>(0);
  const authCooldownMs = 2000; // 2 second cooldown to prevent loops

  const performAuthentication = useCallback(
    async (isInitialAuth = false) => {
      if (isAuthenticating) return;

      // Prevent rapid re-authentication attempts (e.g., after user cancellation)
      const now = Date.now();
      if (now - lastAuthAttempt.current < authCooldownMs) {
        return;
      }

      setIsAuthenticating(true);
      lastAuthAttempt.current = now;

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
    [isAuthenticating, authenticateWithBiometrics, authCooldownMs]
  );

  useEffect(() => {
    if (!hasTriedInitialAuth && !biometricInfo.isLoading && biometricInfo.isAvailable) {
      // Add a small delay to ensure the screen is fully mounted and biometric hardware is ready
      setTimeout(() => {
        performAuthentication(true); // Pass true to indicate this is the initial auth
      }, 500);
    }
  }, [performAuthentication, hasTriedInitialAuth, biometricInfo.isLoading, biometricInfo.isAvailable]);

  // Auto-trigger authentication when app returns from background
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // If app is coming from background to foreground and biometrics are available
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (!biometricInfo.isLoading && biometricInfo.isAvailable && !isAuthenticating) {
          // Check cooldown to prevent loops after user cancellation
          const now = Date.now();
          if (now - lastAuthAttempt.current >= authCooldownMs) {
            // Small delay to ensure the screen is ready
            setTimeout(() => {
              performAuthentication(false);
            }, 300);
          }
        }
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [performAuthentication, biometricInfo.isLoading, biometricInfo.isAvailable, isAuthenticating, authCooldownMs]);

  const handleAuthenticate = () => {
    // Handle case where biometrics are enabled in app but not available on device
    if (isBiometricEnabled && !biometricInfo.isAvailable) {
      Linking.openSettings();
      return;
    }

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
    // Check if biometrics are enabled in app but not available on device
    if (isBiometricEnabled && !biometricInfo.isAvailable) {
      return 'Your wallet is protected with biometric authentication. Please re-enable biometric authentication in your device settings to access your wallet.';
    }

    if (!biometricInfo.isAvailable || !biometricInfo.biometricType) {
      return 'Use biometric authentication to unlock your wallet';
    }

    const authMethod = biometricInfo.displayName || 'biometric authentication';
    return `Use ${authMethod} or device PIN to unlock your wallet`;
  };

  const getButtonText = () => {
    // Handle case where biometrics are enabled in app but not available on device
    if (isBiometricEnabled && !biometricInfo.isAvailable) {
      return 'Open Settings';
    }

    if (isAuthenticating) return 'Authenticating...';
    if (hasTriedInitialAuth) return 'Try Again';

    if (biometricInfo.biometricType === 'FaceID') return 'Use Face ID or PIN';
    if (biometricInfo.biometricType === 'TouchID') return 'Use Touch ID or PIN';
    if (biometricInfo.biometricType === 'Fingerprint') return 'Use Fingerprint or PIN';

    return 'Unlock with Biometrics or PIN';
  };

  return (
    <GradientScreen variant={network}>
      <View style={[styles.container, { backgroundColor: 'transparent' }]}>
        {biometricInfo.isLoading ? (
          <ActivityIndicator size="large" color="rgba(255, 255, 255, 0.8)" />
        ) : (
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              {isBiometricEnabled && !biometricInfo.isAvailable ? (
                <MaterialIcons name="warning" size={80} color="rgba(255, 193, 7, 0.8)" />
              ) : (
                <Image source={require('@/assets/images/splash-icon.png')} style={styles.splashIcon} resizeMode="contain" />
              )}
            </View>

            <ThemedText style={styles.title}>Unlock Layerz Wallet</ThemedText>

            <ThemedText style={styles.subtitle}>{getBiometricText()}</ThemedText>

            {(hasTriedInitialAuth || !biometricInfo.isAvailable) && (
              <TouchableOpacity style={styles.retryButton} onPress={handleAuthenticate} disabled={isAuthenticating}>
                <MaterialIcons name={isBiometricEnabled && !biometricInfo.isAvailable ? 'settings' : 'refresh'} size={24} color="rgba(255, 255, 255, 0.8)" />
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
  splashIcon: {
    width: 80,
    height: 80,
    opacity: 0.8,
  },
});
