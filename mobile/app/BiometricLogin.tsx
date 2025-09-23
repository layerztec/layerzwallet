import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, Alert, Pressable, Image, Linking, AppState, AppStateStatus, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthState } from '@/src/hooks/AuthStateContext';
import { useBiometrics } from '@/hooks/useBiometrics';
import { isDevicePasscodeEnabled } from '@/utils/deviceSecurity';

export default function BiometricLoginScreen() {
  const { authenticateWithBiometrics, isBiometricEnabled } = useAuthState();
  const biometricInfo = useBiometrics();

  const [authState, setAuthState] = useState({
    isAuthenticating: false,
    hasTriedInitial: false,
    showRetryButton: false,
    isFromBackground: false,
    hasAutoTriggered: false,
  });

  const [isAlertShowing, setIsAlertShowing] = useState(false);
  const [hasDevicePasscode, setHasDevicePasscode] = useState<boolean | null>(null);
  const lastAuthAttemptTime = useRef<number>(0);
  const appState = useRef(AppState.currentState);

  const performAuthentication = useCallback(
    async (isInitialAuth = false) => {
      if (authState.isAuthenticating) return;

      lastAuthAttemptTime.current = Date.now();

      setAuthState((prev) => ({
        ...prev,
        isAuthenticating: true,
        showRetryButton: !prev.isFromBackground,
      }));

      try {
        const timeoutId = setTimeout(() => {
          console.debug('BiometricLogin: Authentication timeout - resetting state');
          setAuthState((prev) => ({
            ...prev,
            isAuthenticating: false,
            showRetryButton: true,
            isFromBackground: false,
          }));
        }, 30000);

        const success = await authenticateWithBiometrics();

        clearTimeout(timeoutId);

        if (!success) {
          setAuthState((prev) => ({
            ...prev,
            isAuthenticating: false,
            hasTriedInitial: isInitialAuth ? true : prev.hasTriedInitial,
            showRetryButton: true,
            isFromBackground: false,
          }));
        } else {
          setAuthState((prev) => ({
            ...prev,
            isFromBackground: false,
            hasAutoTriggered: false,
          }));
        }
      } catch (error) {
        setAuthState((prev) => ({
          ...prev,
          isAuthenticating: false,
          hasTriedInitial: isInitialAuth ? true : prev.hasTriedInitial,
          showRetryButton: true,
          isFromBackground: false,
        }));
        Alert.alert('Authentication Error', 'Failed to authenticate. Please try again.');
      }
    },
    [authState.isAuthenticating, authenticateWithBiometrics]
  );

  const showBiometricSettingsAlert = useCallback(() => {
    setIsAlertShowing(true);
  }, []);

  const handleAuthenticate = () => {
    if (isBiometricEnabled && !biometricInfo.isAvailable) {
      // If biometric is enabled in app but not available on device, check if device has passcode
      if (hasDevicePasscode) {
        // Trigger passcode authentication
        performAuthentication(false);
        return;
      } else {
        // No passcode either, open settings
        Linking.openSettings();
        return;
      }
    }

    setAuthState((prev) => ({
      ...prev,
      isFromBackground: false,
      hasAutoTriggered: false,
    }));
    lastAuthAttemptTime.current = 0;
    performAuthentication(false);
  };

  useEffect(() => {
    if (!authState.hasTriedInitial && !biometricInfo.isLoading && (biometricInfo.isAvailable || hasDevicePasscode)) {
      setTimeout(() => {
        performAuthentication(true);
      }, 500);
    }
  }, [performAuthentication, authState.hasTriedInitial, biometricInfo.isLoading, biometricInfo.isAvailable, biometricInfo.biometricType, hasDevicePasscode]);

  useEffect(() => {
    if (!biometricInfo.isLoading && isBiometricEnabled && !biometricInfo.isAvailable) {
      setTimeout(() => {
        showBiometricSettingsAlert();
      }, 300);
    }
  }, [biometricInfo.isLoading, isBiometricEnabled, biometricInfo.isAvailable, showBiometricSettingsAlert]);

  useEffect(() => {
    const checkDevicePasscode = async () => {
      const enabled = await isDevicePasscodeEnabled();
      setHasDevicePasscode(enabled);
    };
    checkDevicePasscode();
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        if (isAlertShowing) {
          setIsAlertShowing(false);
        }
        setAuthState((prev) => ({
          ...prev,
          hasAutoTriggered: false,
        }));
      }

      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        const now = Date.now();
        const timeSinceLastAuth = now - lastAuthAttemptTime.current;
        const cooldownPeriod = 5000;

        if ((biometricInfo.isAvailable || hasDevicePasscode) && !authState.isAuthenticating && !authState.hasAutoTriggered && timeSinceLastAuth > cooldownPeriod) {
          console.debug('BiometricLogin: Auto-triggering from background');
          setAuthState((prev) => ({
            ...prev,
            isFromBackground: true,
            showRetryButton: false,
            hasAutoTriggered: true,
          }));
          biometricInfo.refresh();
          setTimeout(() => {
            performAuthentication(false);
          }, 500);
        } else {
          console.debug('BiometricLogin: Skipping auto-trigger', {
            biometricAvailable: biometricInfo.isAvailable,
            hasDevicePasscode,
            isAuthenticating: authState.isAuthenticating,
            hasAutoTriggered: authState.hasAutoTriggered,
            timeSinceLastAuth,
            cooldownPeriod,
          });
        }
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isAlertShowing, biometricInfo, authState.isAuthenticating, authState.hasAutoTriggered, hasDevicePasscode, performAuthentication]);

  const getBiometricIcon = () => {
    if (!biometricInfo.isAvailable || !biometricInfo.biometricType) {
      // If biometrics not available but device has passcode, show lock icon
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
          <Image source={require('@/assets/images/splash-icon.png')} style={styles.splashIcon} resizeMode="contain" />
        </View>

        {!biometricInfo.isLoading && !biometricInfo.isAvailable && hasDevicePasscode === false && (
          <View style={styles.settingsContainer}>
            <Text style={styles.settingsText}>
              Your wallet requires device security. Please enable biometric authentication or a device passcode/PIN in your device settings to access your wallet.
            </Text>
            <Pressable style={styles.settingsButton} onPress={handleAuthenticate}>
              <Text style={styles.settingsButtonText}>Open Settings</Text>
            </Pressable>
          </View>
        )}

        {authState.showRetryButton && !authState.isAuthenticating && !authState.isFromBackground && !(hasDevicePasscode === false && !biometricInfo.isAvailable) && (
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
