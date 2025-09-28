import React, { useEffect, useState, useCallback, useRef, useContext } from 'react';
import { View, StyleSheet, Alert, Pressable, Image, Linking, Text, AppState, AppStateStatus } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import { useSegments, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthState } from '@/src/hooks/AuthStateContext';
import { useBiometrics } from '@/hooks/useBiometrics';
import { isDevicePasscodeEnabled } from '@/utils/deviceSecurity';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { isInMainApp } from '@/src/utils/navigationUtils';

interface BiometricLoginScreenProps {
  autoTrigger?: boolean;
}

export default function BiometricLoginScreen({ autoTrigger = false }: BiometricLoginScreenProps = {}) {
  const { authenticateWithBiometrics, isBiometricEnabled, isAuthenticated } = useAuthState();
  const biometricInfo = useBiometrics();
  const router = useRouter();
  const segments = useSegments();

  const [authState, setAuthState] = useState({
    isAuthenticating: false,
    hasTriedInitial: false,
    showRetryButton: false,
    isFromBackground: false,
    hasAutoTriggered: false,
    userCancelled: false,
  });

  const [isAlertShowing, setIsAlertShowing] = useState(false);
  const [hasDevicePasscode, setHasDevicePasscode] = useState<boolean | null>(null);
  const lastAuthAttemptTime = useRef<number>(0);
  const authenticationTimeoutRef = useRef<number | null>(null);
  const hasAutoTriggeredOnMount = useRef<boolean>(false);
  const appStateRef = useRef(AppState.currentState);
  const wasInBackground = useRef<boolean>(false);

  const handleAuthenticationError = useCallback((error?: string, warning?: string): boolean => {
    console.debug('BiometricLogin: Authentication error:', { error, warning });

    switch (error) {
      case 'user_cancel':
        return false;

      case 'user_fallback':
        return true;

      case 'system_cancel':
        return true;

      case 'lockout':
        Alert.alert('Authentication Locked', 'Too many failed attempts. Please wait and try again, or use your device passcode.', [{ text: 'OK' }]);
        return true;

      case 'authentication_failed':
        return true;

      case 'timeout':
        Alert.alert('Authentication Timeout', 'Authentication timed out. Please try again.', [{ text: 'OK' }]);
        return true;

      default:
        if (warning) {
          console.warn('BiometricLogin: Authentication warning:', warning);
        }
        return true;
    }
  }, []);

  const performAuthentication = useCallback(
    async (isInitialAuth = false) => {
      if (authState.isAuthenticating) return;

      lastAuthAttemptTime.current = Date.now();

      setAuthState((prev) => ({
        ...prev,
        isAuthenticating: true,
        showRetryButton: !prev.isFromBackground,
      }));

      console.debug('BiometricLogin: Starting authentication', {
        isInitialAuth,
        isAuthenticating: authState.isAuthenticating,
      });

      try {
        authenticationTimeoutRef.current = setTimeout(async () => {
          console.debug('BiometricLogin: Authentication timeout - canceling and resetting state');
          try {
            await LocalAuthentication.cancelAuthenticate();
          } catch (cancelError) {
            console.debug('BiometricLogin: Error canceling authentication:', cancelError);
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setAuthState((prev) => ({
            ...prev,
            isAuthenticating: false,
            hasTriedInitial: true, // Set to true after timeout
            showRetryButton: true,
            isFromBackground: false,
          }));
          authenticationTimeoutRef.current = null;
        }, 30000);

        const result = await authenticateWithBiometrics();

        if (authenticationTimeoutRef.current) {
          clearTimeout(authenticationTimeoutRef.current);
          authenticationTimeoutRef.current = null;
        }

        console.debug('BiometricLogin: Authentication completed', {
          success: result.success,
          error: 'error' in result ? result.error : undefined,
          warning: 'warning' in result ? result.warning : undefined,
        });

        if (result.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setAuthState((prev) => ({
            ...prev,
            isFromBackground: false,
            hasAutoTriggered: false,
            userCancelled: false,
          }));

          if (router.canDismiss()) {
            router.dismiss();
          } else {
            router.replace('/Home');
          }
        } else {
          const error = 'error' in result ? result.error : 'unknown';
          const warning = 'warning' in result ? result.warning : undefined;
          const shouldShowRetryButton = handleAuthenticationError(error, warning);
          const isUserCancel = error === 'user_cancel';
          const isSystemCancel = error === 'system_cancel';

          console.debug('BiometricLogin: Authentication failed', {
            error,
            isUserCancel,
            isSystemCancel,
            shouldShowRetryButton,
          });

          console.debug('BiometricLogin: Checking if should auto-retry', {
            error,
            biometricType: biometricInfo.biometricType,
            shouldRetry: !isUserCancel && !isSystemCancel && error !== 'user_fallback',
          });

          if (!isUserCancel && !isSystemCancel && error !== 'user_fallback') {
            console.debug('BiometricLogin: Auto-retrying authentication after failure');
            performAuthentication(isInitialAuth);
            return;
          }

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

          setAuthState((prev) => ({
            ...prev,
            isAuthenticating: false,
            hasTriedInitial: true,
            showRetryButton: false,
            isFromBackground: false,
            userCancelled: isUserCancel,
          }));

          if (shouldShowRetryButton) {
            setAuthState((prev) => ({
              ...prev,
              showRetryButton: true,
            }));
          }
        }
      } catch (error) {
        console.debug('BiometricLogin: Authentication threw error', error);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setAuthState((prev) => ({
          ...prev,
          isAuthenticating: false,
          hasTriedInitial: true,
          showRetryButton: false,
          isFromBackground: false,
        }));
        Alert.alert('Authentication Error', 'Failed to authenticate. Please try again.');

        setAuthState((prev) => ({
          ...prev,
          showRetryButton: true,
        }));
      }
    },
    [authState.isAuthenticating, authenticateWithBiometrics, handleAuthenticationError, biometricInfo.biometricType, router]
  );

  const showBiometricSettingsAlert = useCallback(() => {
    setIsAlertShowing(true);
  }, []);

  const handleAuthenticate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isBiometricEnabled && !biometricInfo.isAvailable) {
      if (hasDevicePasscode) {
        performAuthentication(false);
        return;
      } else {
        Linking.openSettings();
        return;
      }
    }

    setAuthState((prev) => ({
      ...prev,
      isFromBackground: false,
      hasAutoTriggered: false,
      userCancelled: false,
    }));
    lastAuthAttemptTime.current = 0;
    performAuthentication(false);
  };

  useEffect(() => {
    if (hasDevicePasscode === null) {
      isDevicePasscodeEnabled().then(setHasDevicePasscode);
      return;
    }

    if (!biometricInfo.isLoading && isBiometricEnabled && !biometricInfo.isAvailable) {
      showBiometricSettingsAlert();
      return;
    }

    const hasValidAuth = biometricInfo.isAvailable || hasDevicePasscode;
    const isReady = !biometricInfo.isLoading && !authState.isAuthenticating;

    const shouldAutoTrigger =
      (!authState.hasTriedInitial && isReady && hasValidAuth && !authState.userCancelled) || (autoTrigger && isReady && hasValidAuth && !authState.hasAutoTriggered && !authState.userCancelled);

    if (shouldAutoTrigger) {
      console.debug('BiometricLogin: Auto-triggering authentication', {
        autoTrigger,
        hasTriedInitial: authState.hasTriedInitial,
        hasValidAuth,
        biometricAvailable: biometricInfo.isAvailable,
        hasDevicePasscode,
        securityLevel: biometricInfo.securityLevel,
        userCancelled: authState.userCancelled,
      });

      performAuthentication(true);
    }
  }, [
    autoTrigger,
    performAuthentication,
    showBiometricSettingsAlert,
    authState.hasTriedInitial,
    authState.isAuthenticating,
    authState.hasAutoTriggered,
    authState.userCancelled,
    biometricInfo.isLoading,
    biometricInfo.isAvailable,
    biometricInfo.securityLevel,
    isBiometricEnabled,
    hasDevicePasscode,
  ]);

  useEffect(() => {
    return () => {
      if (authenticationTimeoutRef.current) {
        clearTimeout(authenticationTimeoutRef.current);
        LocalAuthentication.cancelAuthenticate().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (!hasAutoTriggeredOnMount.current && authState.hasTriedInitial === false) {
      const now = Date.now();
      const timeSinceLastAuth = now - lastAuthAttemptTime.current;
      const hasValidAuth = biometricInfo.isAvailable || hasDevicePasscode;

      if (hasValidAuth && !authState.isAuthenticating && timeSinceLastAuth > 1000) {
        hasAutoTriggeredOnMount.current = true;
        console.debug('BiometricLogin: Auto-triggering on initial mount');

        setAuthState((prev) => ({
          ...prev,
          isFromBackground: false,
          showRetryButton: false,
          hasAutoTriggered: true,
        }));
        performAuthentication(false);
      }
    }
  }, [authState.hasTriedInitial, authState.isAuthenticating, biometricInfo.isAvailable, hasDevicePasscode, performAuthentication]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.debug('BiometricLogin: AppState changed', {
        previous: appStateRef.current,
        current: nextAppState,
        isAuthenticating: authState.isAuthenticating,
      });

      if (appStateRef.current === 'active' && nextAppState.match(/inactive|background/)) {
        if (!authState.isAuthenticating) {
          wasInBackground.current = true;
          console.debug('BiometricLogin: App went to true background');
        } else {
          console.debug('BiometricLogin: App went inactive due to biometric UI');
        }
      }

      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active' && wasInBackground.current) {
        const now = Date.now();
        const timeSinceLastAuth = now - lastAuthAttemptTime.current;
        const hasValidAuth = biometricInfo.isAvailable || hasDevicePasscode;

        console.debug('BiometricLogin: App returned from true background', {
          timeSinceLastAuth,
          hasValidAuth,
          isAuthenticating: authState.isAuthenticating,
          userCancelled: authState.userCancelled,
        });

        if (hasValidAuth && !authState.isAuthenticating && timeSinceLastAuth > 2000) {
          console.debug('BiometricLogin: Auto-triggering on true background return');
          wasInBackground.current = false;

          setAuthState((prev) => ({
            ...prev,
            isFromBackground: true,
            showRetryButton: false,
            hasAutoTriggered: true,
            userCancelled: false,
          }));
          performAuthentication(false);
        } else {
          console.debug('BiometricLogin: Background return auto-trigger skipped', {
            hasValidAuth,
            isAuthenticating: authState.isAuthenticating,
            userCancelled: authState.userCancelled,
            timeSinceLastAuth,
            minimumTime: 2000,
          });
          wasInBackground.current = false;
        }
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [authState.isAuthenticating, authState.userCancelled, biometricInfo.isAvailable, hasDevicePasscode, performAuthentication]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        hasAutoTriggeredOnMount.current = false;
        wasInBackground.current = false;
        if (isAlertShowing) {
          setIsAlertShowing(false);
        }
        setAuthState((prev) => ({ ...prev, hasAutoTriggered: false, userCancelled: false }));
      };
    }, [isAlertShowing])
  );

  useEffect(() => {
    console.debug('BiometricLogin: Retry button useEffect check', {
      hasTriedInitial: authState.hasTriedInitial,
      isAuthenticating: authState.isAuthenticating,
      showRetryButton: authState.showRetryButton,
      shouldShow: authState.hasTriedInitial && !authState.isAuthenticating && !authState.showRetryButton,
    });

    if (authState.hasTriedInitial && !authState.isAuthenticating && !authState.showRetryButton) {
      console.debug('BiometricLogin: Showing retry button');
      setAuthState((prev) => ({
        ...prev,
        showRetryButton: true,
        isFromBackground: false,
      }));
    }
  }, [authState.hasTriedInitial, authState.isAuthenticating, authState.showRetryButton]);

  const getBiometricIcon = () => {
    if (!biometricInfo.isAvailable || !biometricInfo.biometricType) {
      if (hasDevicePasscode) {
        return 'lock-closed-outline';
      }
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
          <Image source={require('@/assets/images/splash-icon.png')} style={styles.splashIcon} />
        </View>

        {!biometricInfo.isLoading && !biometricInfo.isAvailable && hasDevicePasscode === false && (
          <View style={styles.settingsContainer}>
            <Text style={styles.settingsText}>
              Your wallet requires device security. Please enable biometric authentication or a device passcode/PIN in your device settings to access your wallet.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.settingsButton, pressed && styles.settingsButtonPressed]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                handleAuthenticate();
              }}
            >
              <Text style={styles.settingsButtonText}>Open Settings</Text>
            </Pressable>
          </View>
        )}

        {authState.showRetryButton && !authState.isAuthenticating && !(hasDevicePasscode === false && !biometricInfo.isAvailable) && (
          <View style={styles.buttonContainer}>
            <Pressable style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]} onPress={handleAuthenticate}>
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
  retryButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    opacity: 0.8,
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
  settingsButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    opacity: 0.8,
  },
  settingsButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
});

// Modal handler component that shows the modal when needed
export function BiometricModalHandler() {
  const { isAuthenticated, isBiometricEnabled, isUpdatingBiometric } = useAuthState();
  const segments = useSegments();
  const router = useRouter();
  const { dismissScanner } = useContext(ScanQrContext);

  // Determine if user is currently in main app (indicates they've authenticated before)
  const userInMainApp = isInMainApp(segments);

  // Show modal when user has been to main app before but is now locked
  const shouldShowBiometricModal = isBiometricEnabled && userInMainApp && !isAuthenticated && !isUpdatingBiometric;

  // Use router to present the biometric modal
  useEffect(() => {
    if (shouldShowBiometricModal) {
      dismissScanner();
      // Present BiometricLogin as a modal
      router.push('/BiometricLogin');
    }
  }, [shouldShowBiometricModal, dismissScanner, router]);

  return null;
}
