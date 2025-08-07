import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, TouchableOpacity, View, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { gradients } from '@shared/constants/Colors';
import { useSecurityContext } from '@/hooks/useSecurityContext';
import type { UnlockRouteParams } from '@/types/routes';
import { UNLOCK_ACTIONS } from '@/types/routes';

const UnlockScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<UnlockRouteParams>();
  const action = params.action;
  const { isAppLocked, isSecurityEnabled, isAuthenticationAvailable, biometricType, hasSecurityMismatch, unlockApp, checkSecurityAvailability, disableSecurity, enableSecurity } = useSecurityContext();

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showRetryButton, setShowRetryButton] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [autoUnlockAttempted, setAutoUnlockAttempted] = useState(false);

  useEffect(() => {
    if (action === UNLOCK_ACTIONS.DISABLE_SECURITY || action === UNLOCK_ACTIONS.ENABLE_SECURITY) {
      return;
    }

    if (!isAppLocked && isSecurityEnabled) {
      router.replace('/Home');
      return;
    }

    if (!isSecurityEnabled) {
      router.replace('/Home');
      return;
    }
  }, [isAppLocked, isSecurityEnabled, router, action]);

  // Handle security mismatch case
  useEffect(() => {
    if (hasSecurityMismatch) {
      setShowRetryButton(true);
    }
  }, [hasSecurityMismatch]);

  const handleUnlock = useCallback(async () => {
    setIsAuthenticating(true);
    setShowRetryButton(false);
    setAuthError(null);

    try {
      const result = await unlockApp();

      if (result.success) {
        if (action === UNLOCK_ACTIONS.DISABLE_SECURITY) {
          await disableSecurity();
          try {
            router.dismiss();
          } catch {
            router.replace('/settings');
          }
        } else if (action === UNLOCK_ACTIONS.ENABLE_SECURITY) {
          await enableSecurity();
          try {
            router.dismiss();
          } catch {
            router.replace('/settings');
          }
        }
      } else if (result.cancelled) {
        setShowRetryButton(true);
      } else {
        setAuthError(result.error || 'Authentication failed');
        setShowRetryButton(true);
      }
    } catch (error) {
      console.error('Unlock error:', error);
      setAuthError('An unexpected error occurred');
      setShowRetryButton(true);
    } finally {
      setIsAuthenticating(false);
    }
  }, [unlockApp, router, action, disableSecurity, enableSecurity]);

  const handleSecurityMismatch = useCallback(() => {
    Alert.alert(
      'Security Settings Required',
      `Your device's ${biometricType || 'biometric'} authentication or passcode appears to be disabled. Please enable it in your device settings to continue using Layerz Wallet securely.`,
      [
        {
          text: 'Open Settings',
          onPress: () => Linking.openSettings(),
        },
        {
          text: 'Check Again',
          onPress: async () => {
            await checkSecurityAvailability();
            if (!hasSecurityMismatch) {
              handleUnlock();
            }
          },
        },
        {
          text: 'Disable Security',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Disable Security?', 'This will disable app security and allow access without authentication. This is not recommended.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Disable',
                style: 'destructive',
                onPress: async () => {
                  const authResult = await unlockApp();
                  if (authResult.success) {
                    await disableSecurity();
                    try {
                      router.dismiss();
                    } catch {
                      router.back();
                    }
                  } else if (!authResult.cancelled) {
                    Alert.alert('Authentication Required', 'You must authenticate to disable security features.', [{ text: 'OK' }]);
                  }
                },
              },
            ]);
          },
        },
      ],
      { cancelable: false }
    );
  }, [biometricType, checkSecurityAvailability, disableSecurity, handleUnlock, hasSecurityMismatch, router, unlockApp]);

  useEffect(() => {
    if (action === UNLOCK_ACTIONS.ENABLE_SECURITY || action === UNLOCK_ACTIONS.DISABLE_SECURITY) {
      return;
    }

    if (isAuthenticationAvailable && !hasSecurityMismatch && !isAuthenticating && !autoUnlockAttempted) {
      setAutoUnlockAttempted(true);
      handleUnlock();
    } else if (hasSecurityMismatch) {
      handleSecurityMismatch();
    }
  }, [isAuthenticationAvailable, hasSecurityMismatch, isAuthenticating, autoUnlockAttempted, handleUnlock, handleSecurityMismatch, action]);

  const handleClose = useCallback(() => {
    if (action === UNLOCK_ACTIONS.ENABLE_SECURITY || action === UNLOCK_ACTIONS.DISABLE_SECURITY) {
      try {
        router.dismiss();
      } catch {
        router.replace('/settings');
      }
    } else {
      try {
        router.back();
      } catch (error) {
        router.replace('/Home');
      }
    }
  }, [router, action]);

  const getBiometricIcon = () => {
    switch (biometricType) {
      case 'FaceID':
        return 'scan';
      case 'TouchID':
      case 'Fingerprint':
        return 'finger-print';
      case 'Iris':
        return 'eye';
      default:
        return 'shield-checkmark';
    }
  };

  const getUnlockMessage = () => {
    if (hasSecurityMismatch) {
      return 'Security Settings Issue';
    }

    if (!isAuthenticationAvailable && action === UNLOCK_ACTIONS.ENABLE_SECURITY) {
      return 'Authentication Required';
    }

    if (!isAuthenticationAvailable) {
      return 'Authentication Unavailable';
    }

    if (authError) {
      return 'Authentication Failed';
    }

    if (action === UNLOCK_ACTIONS.ENABLE_SECURITY) {
      return 'Enable App Lock';
    }

    if (action === UNLOCK_ACTIONS.DISABLE_SECURITY) {
      return 'Disable App Lock';
    }

    if (biometricType) {
      return `Use ${biometricType} to unlock`;
    }

    return 'Use device authentication to unlock';
  };

  const getSubMessage = () => {
    if (hasSecurityMismatch) {
      return `Your device's ${biometricType || 'authentication'} settings have changed. Please update your device settings.`;
    }

    if (!isAuthenticationAvailable && action === UNLOCK_ACTIONS.ENABLE_SECURITY) {
      return 'Device authentication is required to enable App Lock. Please set up Face ID, Touch ID, or a device passcode in your settings.';
    }

    if (!isAuthenticationAvailable) {
      return 'Device authentication is not set up or available.';
    }

    if (authError) {
      return authError;
    }

    if (action === UNLOCK_ACTIONS.ENABLE_SECURITY) {
      return `Authenticate to enable App Lock with ${biometricType || 'device authentication'}`;
    }

    if (action === UNLOCK_ACTIONS.DISABLE_SECURITY) {
      return `Authenticate to disable App Lock`;
    }

    return 'Tap to authenticate';
  };

  return (
    <LinearGradient colors={gradients.blueGradient} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {(action === UNLOCK_ACTIONS.ENABLE_SECURITY || action === UNLOCK_ACTIONS.DISABLE_SECURITY) && (
          <View style={styles.closeButtonRow}>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose} testID="UnlockCloseButton">
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.content}>
          <Image source={require('../assets/images/logo.png')} style={styles.logo} />

          <View style={styles.textContainer}>
            <ThemedText style={styles.message}>{getUnlockMessage()}</ThemedText>
            <ThemedText style={styles.subMessage}>{getSubMessage()}</ThemedText>
          </View>

          <View style={styles.buttonContainer}>
            {isAuthenticating ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="white" />
                <ThemedText style={styles.loadingText}>Authenticating...</ThemedText>
              </View>
            ) : (
              <>
                {hasSecurityMismatch ? (
                  <TouchableOpacity style={styles.primaryButton} onPress={handleSecurityMismatch} activeOpacity={0.8}>
                    <Ionicons name="settings" size={24} color="white" style={styles.buttonIcon} />
                    <ThemedText style={styles.buttonText}>Fix Settings</ThemedText>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.primaryButton} onPress={handleUnlock} activeOpacity={0.8}>
                    <Ionicons name={getBiometricIcon()} size={24} color="white" style={styles.buttonIcon} />
                    <ThemedText style={styles.buttonText}>
                      {action === UNLOCK_ACTIONS.ENABLE_SECURITY ? 'Enable App Lock' : action === UNLOCK_ACTIONS.DISABLE_SECURITY ? 'Disable App Lock' : showRetryButton ? 'Try Again' : 'Unlock'}
                    </ThemedText>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  closeButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  closeButton: {
    padding: 10,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 48,
  },
  iconBackground: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    width: 200,
    height: 60,
    resizeMode: 'contain',
    marginVertical: 120,
  },
  message: {
    fontSize: 20,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 12,
    textAlign: 'center',
  },
  subMessage: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  buttonContainer: {
    width: '100%',
    position: 'absolute',
    bottom: 50,
    left: 24,
    right: 24,
  },
  primaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    minHeight: 56,
  },
  buttonIcon: {
    marginRight: 12,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 12,
  },
});

export default UnlockScreen;
