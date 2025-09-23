import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, Alert, Pressable, Image, Linking, AppState, AppStateStatus, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthState } from '@/src/hooks/AuthStateContext';
import { useBiometrics } from '@/hooks/useBiometrics';

export default function BiometricLoginScreen() {
  const { authenticateWithBiometrics, isBiometricEnabled } = useAuthState();
  const biometricInfo = useBiometrics();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [hasTriedInitialAuth, setHasTriedInitialAuth] = useState(false);
  const [shouldShowRetryButton, setShouldShowRetryButton] = useState(false);
  const [isAlertShowing, setIsAlertShowing] = useState(false);
  const [isReturnFromBackground, setIsReturnFromBackground] = useState(false);
  const [hasAutoTriggeredFromBackground, setHasAutoTriggeredFromBackground] = useState(false);
  const lastAuthAttemptTime = useRef<number>(0);
  const appState = useRef(AppState.currentState);

  const performAuthentication = useCallback(
    async (isInitialAuth = false) => {
      if (isAuthenticating) return;

      // Record the time of this authentication attempt
      lastAuthAttemptTime.current = Date.now();

      setIsAuthenticating(true);

      // Don't show retry button immediately if this is an auto-trigger from background
      if (!isReturnFromBackground) {
        setShouldShowRetryButton(true);
      }

      try {
        // Set up a timeout that will reset the authenticating state
        // This is a safety mechanism, not a race condition
        const timeoutId = setTimeout(() => {
          console.log('🔐 BiometricLogin: Authentication timeout - resetting state');
          setIsAuthenticating(false);
          setShouldShowRetryButton(true);
          setIsReturnFromBackground(false);
        }, 30000); // 30 second safety timeout

        const success = await authenticateWithBiometrics();

        // Clear the timeout since authentication completed
        clearTimeout(timeoutId);

        if (!success) {
          setIsAuthenticating(false);
          if (isInitialAuth) {
            setHasTriedInitialAuth(true);
          }

          // If user dismissed the native UI (from background or manual), show the retry button
          setShouldShowRetryButton(true);
          setIsReturnFromBackground(false);
        } else {
          // Authentication succeeded
          setIsReturnFromBackground(false);
          setHasAutoTriggeredFromBackground(false);
        }
      } catch (error) {
        setIsAuthenticating(false);
        if (isInitialAuth) {
          setHasTriedInitialAuth(true);
        }

        // On error, show the retry button
        setShouldShowRetryButton(true);
        setIsReturnFromBackground(false);
        Alert.alert('Authentication Error', 'Failed to authenticate. Please try again.');
      }
    },
    [isAuthenticating, authenticateWithBiometrics, isReturnFromBackground]
  );

  const showBiometricSettingsAlert = useCallback(() => {
    setIsAlertShowing(true);
  }, []);

  const handleAuthenticate = () => {
    if (isBiometricEnabled && !biometricInfo.isAvailable) {
      Linking.openSettings();
      return;
    }

    // Reset background-related states when user manually triggers
    setIsReturnFromBackground(false);
    setHasAutoTriggeredFromBackground(false);
    // Reset the cooldown timer for manual triggers
    lastAuthAttemptTime.current = 0;
    performAuthentication(false);
  };

  useEffect(() => {
    if (!hasTriedInitialAuth && !biometricInfo.isLoading && biometricInfo.isAvailable) {
      setTimeout(() => {
        performAuthentication(true);
      }, 500);
    }
  }, [performAuthentication, hasTriedInitialAuth, biometricInfo.isLoading, biometricInfo.isAvailable, biometricInfo.biometricType]);

  useEffect(() => {
    if (!biometricInfo.isLoading && isBiometricEnabled && !biometricInfo.isAvailable) {
      setTimeout(() => {
        showBiometricSettingsAlert();
      }, 300);
    }
  }, [biometricInfo.isLoading, isBiometricEnabled, biometricInfo.isAvailable, showBiometricSettingsAlert]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        if (isAlertShowing) {
          setIsAlertShowing(false);
        }
        // Reset the auto-trigger flag when going to background
        setHasAutoTriggeredFromBackground(false);
      }

      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        const now = Date.now();
        const timeSinceLastAuth = now - lastAuthAttemptTime.current;
        const cooldownPeriod = 5000; // 5 seconds cooldown

        // Only auto-trigger if:
        // 1. Biometrics are available
        // 2. Not currently authenticating
        // 3. Haven't auto-triggered for this background session
        // 4. Enough time has passed since last authentication attempt (cooldown)
        if (biometricInfo.isAvailable && !isAuthenticating && !hasAutoTriggeredFromBackground && timeSinceLastAuth > cooldownPeriod) {
          console.log('🔐 BiometricLogin: Auto-triggering from background');
          setIsReturnFromBackground(true);
          setShouldShowRetryButton(false);
          setHasAutoTriggeredFromBackground(true);
          biometricInfo.refresh();
          setTimeout(() => {
            performAuthentication(false);
          }, 500);
        } else {
          console.log('🔐 BiometricLogin: Skipping auto-trigger', {
            isAvailable: biometricInfo.isAvailable,
            isAuthenticating,
            hasAutoTriggered: hasAutoTriggeredFromBackground,
            timeSinceLastAuth,
            cooldownPeriod,
          });
        }
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isAlertShowing, biometricInfo, isAuthenticating, hasAutoTriggeredFromBackground, performAuthentication]);

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

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.splashContainer}>
          <Image source={require('@/assets/images/splash-icon.png')} style={styles.splashIcon} resizeMode="contain" />
        </View>

        {!biometricInfo.isLoading && isBiometricEnabled && !biometricInfo.isAvailable && (
          <View style={styles.settingsContainer}>
            <Text style={styles.settingsText}>Your wallet is protected with biometric authentication. Please enable biometric authentication in your device settings to access your wallet.</Text>
            <Pressable style={styles.settingsButton} onPress={handleAuthenticate}>
              <Text style={styles.settingsButtonText}>Open Settings</Text>
            </Pressable>
          </View>
        )}

        {shouldShowRetryButton && !isAuthenticating && !isReturnFromBackground && !(isBiometricEnabled && !biometricInfo.isAvailable) && (
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
    backgroundColor: '#000000',
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
