import React, { useEffect, useState, useCallback, useContext, useRef } from 'react';
import { View, StyleSheet, Alert, Pressable, Image, Linking, AppState, AppStateStatus, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthState } from '@/src/hooks/AuthStateContext';
import { useBiometrics } from '@/hooks/useBiometrics';
import { NetworkContext } from '@shared/hooks/NetworkContext';

export default function BiometricLoginScreen() {
  const { authenticateWithBiometrics, isBiometricEnabled, disableBiometricAuth } = useAuthState();
  const biometricInfo = useBiometrics();
  const { network } = useContext(NetworkContext);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [hasTriedInitialAuth, setHasTriedInitialAuth] = useState(false);
  const [shouldShowRetryButton, setShouldShowRetryButton] = useState(false);
  const [isAlertShowing, setIsAlertShowing] = useState(false);
  const lastAuthAttempt = useRef<number>(0);
  const authCooldownMs = 2000; // 2 second cooldown to prevent loops
  const appState = useRef(AppState.currentState);

  const performAuthentication = useCallback(
    async (isInitialAuth = false) => {
      console.log('🔐 BiometricLogin: performAuthentication called:', { isInitialAuth, isAuthenticating });

      if (isAuthenticating) return;

      // Prevent rapid re-authentication attempts (e.g., after user cancellation)
      const now = Date.now();
      if (now - lastAuthAttempt.current < authCooldownMs) {
        console.log('🔐 BiometricLogin: Skipping due to cooldown');
        return;
      }

      setIsAuthenticating(true);
      lastAuthAttempt.current = now;

      // Set retry button to show immediately when authentication starts
      // This prevents flickering when user dismisses biometric prompt
      setShouldShowRetryButton(true);

      try {
        console.log('🔐 BiometricLogin: Starting authenticateWithBiometrics...');

        // Add a timeout to prevent hanging authentication
        const authPromise = authenticateWithBiometrics();
        const timeoutPromise = new Promise<boolean>((resolve) => {
          setTimeout(() => {
            console.log('🔐 BiometricLogin: Authentication timeout after 8 seconds');
            resolve(false);
          }, 8000);
        });

        const success = await Promise.race([authPromise, timeoutPromise]);
        console.log('🔐 BiometricLogin: Authentication result:', success);

        if (!success) {
          setIsAuthenticating(false);
          // Only set hasTriedInitialAuth to true after the first authentication attempt completes
          if (isInitialAuth) {
            setHasTriedInitialAuth(true);
          }
        }
        // If success is true, the authentication succeeded and the screen should be navigated away
        // so we don't need to handle that case here
      } catch (error) {
        console.error('🔐 BiometricLogin: Authentication error:', error);
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

  const showBiometricSettingsAlert = useCallback(() => {
    // Just set the alert showing state - text will be displayed in UI
    setIsAlertShowing(true);
  }, []);

  const handleAuthenticate = () => {
    // Handle case where biometrics are enabled in app but not available on device
    if (isBiometricEnabled && !biometricInfo.isAvailable) {
      Linking.openSettings();
      return;
    }

    performAuthentication(false); // Pass false for manual authentication
  };

  useEffect(() => {
    console.log('🔐 BiometricLogin: Initial auth check:', {
      hasTriedInitialAuth,
      isLoading: biometricInfo.isLoading,
      isAvailable: biometricInfo.isAvailable,
      biometricType: biometricInfo.biometricType,
    });

    if (!hasTriedInitialAuth && !biometricInfo.isLoading && biometricInfo.isAvailable) {
      console.log('🔐 BiometricLogin: Triggering initial authentication');
      // Add a small delay to ensure the screen is fully mounted and biometric hardware is ready
      setTimeout(() => {
        performAuthentication(true); // Pass true to indicate this is the initial auth
      }, 500);
    }
  }, [performAuthentication, hasTriedInitialAuth, biometricInfo.isLoading, biometricInfo.isAvailable, biometricInfo.biometricType]);

  // Auto-trigger settings alert when biometrics are enabled but not available
  useEffect(() => {
    if (!biometricInfo.isLoading && isBiometricEnabled && !biometricInfo.isAvailable) {
      // Small delay to ensure the screen is ready and avoid conflicts with auth attempts
      setTimeout(() => {
        showBiometricSettingsAlert();
      }, 300);
    }
  }, [biometricInfo.isLoading, isBiometricEnabled, biometricInfo.isAvailable, showBiometricSettingsAlert]);

  // Auto-dismiss alert when app goes to background
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        // App is going to background, dismiss any showing alert
        if (isAlertShowing) {
          setIsAlertShowing(false);
          // Alert will be auto-dismissed by the system when app backgrounds
        }
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isAlertShowing]);

  const getBiometricIcon = () => {
    if (!biometricInfo.isAvailable || !biometricInfo.biometricType) {
      return 'shield-outline';
    }

    switch (biometricInfo.biometricType) {
      case 'FaceID':
        return 'scan-outline';
      case 'TouchID':
      case 'Fingerprint':
        return 'finger-print-outline';
      default:
        return 'shield-outline';
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
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Main splash icon - always visible */}
        <View style={styles.splashContainer}>
          <Image source={require('@/assets/images/splash-icon.png')} style={styles.splashIcon} resizeMode="contain" />
        </View>

        {/* Show text and button when biometrics are enabled but not available */}
        {!biometricInfo.isLoading && isBiometricEnabled && !biometricInfo.isAvailable && (
          <View style={styles.settingsContainer}>
            <Text style={styles.settingsText}>Your wallet is protected with biometric authentication. Please enable biometric authentication in your device settings to access your wallet.</Text>
            <Pressable style={styles.settingsButton} onPress={handleAuthenticate}>
              <Text style={styles.settingsButtonText}>Open Settings</Text>
            </Pressable>
          </View>
        )}

        {/* Show retry button for normal authentication scenarios */}
        {shouldShowRetryButton && !isAuthenticating && !(isBiometricEnabled && !biometricInfo.isAvailable) && (
          <View style={styles.buttonContainer}>
            <Pressable style={styles.retryButton} onPress={handleAuthenticate}>
              <Ionicons name={getBiometricIcon()} size={24} color="rgba(255, 255, 255, 0.8)" />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // Same as splash screen
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  splashIcon: {
    width: 120,
    height: 120,
    opacity: 0.9,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 80,
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 16,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  retryButtonDisabled: {
    opacity: 0.4,
  },
  settingsContainer: {
    position: 'absolute',
    bottom: 120,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  settingsText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  settingsButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  settingsButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
});
