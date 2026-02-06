import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, AppStateStatus, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { useBiometrics } from '@/hooks/useBiometrics';
import { useAuthState } from '@/src/hooks/AuthStateContext';
import { isDevicePasscodeEnabled } from '@/utils/deviceSecurity';
import { Colors } from '@shared/constants/Colors';

interface BiometricLoginScreenProps {
  autoTrigger?: boolean;
}

export default function BiometricLoginScreen({ autoTrigger = false }: BiometricLoginScreenProps = {}) {
  const { authenticateWithBiometrics, isBiometricEnabled, isAuthenticated } = useAuthState();
  const biometricInfo = useBiometrics();
  const router = useRouter();

  const [authState, setAuthState] = useState({
    isAuthenticating: false,
    hasAutoTriggered: false,
    userCancelled: false,
    hasAttemptedAuth: false,
  });

  const [hasDevicePasscode, setHasDevicePasscode] = useState<boolean | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const wasInBackground = useRef<boolean>(false);

  useEffect(() => {
    if (!isBiometricEnabled) {
      console.debug('BiometricLogin: Biometrics disabled in settings, redirecting away', {
        isBiometricEnabled,
      });

      if (router.canDismiss()) {
        router.dismiss();
      } else {
        router.replace('/Home');
      }
    }
  }, [isBiometricEnabled, router]);

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

      setAuthState((prev) => ({
        ...prev,
        isAuthenticating: true,
        hasAttemptedAuth: true,
      }));

      console.debug('BiometricLogin: Starting authentication', {
        isInitialAuth,
        isAuthenticating: authState.isAuthenticating,
      });

      try {
        const result = await authenticateWithBiometrics();

        console.debug('BiometricLogin: Authentication completed', {
          success: result.success,
          error: 'error' in result ? result.error : undefined,
          warning: 'warning' in result ? result.warning : undefined,
        });

        if (result.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setAuthState((prev) => ({
            ...prev,
            hasAutoTriggered: false,
            userCancelled: false,
          }));

          if (router.canDismiss()) {
            router.dismiss();
          } else {
            console.log('🟦 BiometricLogin: Navigating to /(tabs)/home');
            router.replace('/(tabs)/home');
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
            userCancelled: isUserCancel,
          }));
        }
      } catch (error) {
        console.debug('BiometricLogin: Authentication threw error', error);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setAuthState((prev) => ({
          ...prev,
          isAuthenticating: false,
        }));
        Alert.alert('Authentication Error', 'Failed to authenticate. Please try again.');
      }
    },
    [authState.isAuthenticating, authenticateWithBiometrics, handleAuthenticationError, biometricInfo.biometricType, router]
  );

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
      hasAutoTriggered: false,
      userCancelled: false,
    }));
    performAuthentication(false);
  };

  useEffect(() => {
    if (hasDevicePasscode === null) {
      isDevicePasscodeEnabled().then(setHasDevicePasscode);
      return;
    }

    const hasValidAuth = biometricInfo.isAvailable || hasDevicePasscode;
    const isReady = !biometricInfo.isLoading && !authState.isAuthenticating;

    const shouldAutoTrigger =
      (!authState.hasAttemptedAuth && isReady && hasValidAuth && !authState.userCancelled) || (autoTrigger && isReady && hasValidAuth && !authState.hasAutoTriggered && !authState.userCancelled);

    if (shouldAutoTrigger) {
      console.debug('BiometricLogin: Auto-triggering authentication', {
        autoTrigger,
        hasAttemptedAuth: authState.hasAttemptedAuth,
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
    authState.isAuthenticating,
    authState.hasAutoTriggered,
    authState.userCancelled,
    authState.hasAttemptedAuth,
    biometricInfo.isLoading,
    biometricInfo.isAvailable,
    biometricInfo.securityLevel,
    isBiometricEnabled,
    hasDevicePasscode,
  ]);

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
          console.debug('BiometricLogin: App went to inactive/background');
        } else {
          console.debug('BiometricLogin: App went inactive due to biometric UI');
        }
      }

      // Trigger auth when app becomes active from inactive state
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        const hasValidAuth = biometricInfo.isAvailable || hasDevicePasscode;

        console.debug('BiometricLogin: App returned to active from inactive', {
          hasValidAuth,
          isAuthenticating: authState.isAuthenticating,
          userCancelled: authState.userCancelled,
          wasInBackground: wasInBackground.current,
        });

        if (hasValidAuth && !authState.isAuthenticating) {
          console.debug('BiometricLogin: Auto-triggering authentication on app active');
          wasInBackground.current = false;

          setAuthState((prev) => ({
            ...prev,
            hasAutoTriggered: true,
            userCancelled: false,
          }));
          performAuthentication(false);
        } else {
          console.debug('BiometricLogin: Auth trigger skipped', {
            hasValidAuth,
            isAuthenticating: authState.isAuthenticating,
            userCancelled: authState.userCancelled,
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
        wasInBackground.current = false;
        setAuthState((prev) => ({ ...prev, hasAutoTriggered: false, userCancelled: false, hasAttemptedAuth: false }));
      };
    }, [])
  );

  return (
    <View style={[styles.container, { backgroundColor: Colors.GlobalDarkBackground }]}>
      <View style={styles.content}>
        <View style={styles.splashContainer}>
          <ExpoImage source={require('@/assets/images/splash-icon.png')} style={styles.splashIcon} contentFit="contain" />
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

        {authState.hasAttemptedAuth && !authState.isAuthenticating && !(hasDevicePasscode === false && !biometricInfo.isAvailable) && (
          <View style={styles.buttonContainer}>
            <Pressable style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]} onPress={handleAuthenticate}>
              <Text style={styles.retryButtonText}>Tap to unlock</Text>
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
    width: 100,
    height: 100,
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
  },
  retryButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
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
