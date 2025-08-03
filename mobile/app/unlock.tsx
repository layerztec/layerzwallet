import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { gradients } from '@shared/constants/Colors';
import { useSecurityContext } from '@/hooks/useSecurityContext';

const UnlockScreen: React.FC = () => {
  const router = useRouter();
  const { isAppLocked, isSecurityEnabled, isAuthenticationAvailable, biometricType, hasSecurityMismatch, unlockApp, checkSecurityAvailability, disableSecurity } = useSecurityContext();

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showRetryButton, setShowRetryButton] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [autoUnlockAttempted, setAutoUnlockAttempted] = useState(false);

  // Redirect if app is unlocked or security is disabled
  useEffect(() => {
    if (!isAppLocked && isSecurityEnabled) {
      router.replace('/');
    } else if (!isSecurityEnabled) {
      router.replace('/');
    }
  }, [isAppLocked, isSecurityEnabled, router]);

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
        router.replace('/');
      } else if (result.cancelled) {
        // User cancelled authentication - don't show error, just allow retry
        setShowRetryButton(true);
      } else {
        // Authentication failed with error
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
  }, [unlockApp, router]);

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
                    router.replace('/');
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

  // Auto-trigger unlock on mount if authentication is available (only once)
  useEffect(() => {
    if (isAuthenticationAvailable && !hasSecurityMismatch && !isAuthenticating && !autoUnlockAttempted) {
      setAutoUnlockAttempted(true);
      handleUnlock();
    } else if (hasSecurityMismatch) {
      handleSecurityMismatch();
    }
  }, [isAuthenticationAvailable, hasSecurityMismatch, isAuthenticating, autoUnlockAttempted, handleUnlock, handleSecurityMismatch]);

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

    if (!isAuthenticationAvailable) {
      return 'Authentication Unavailable';
    }

    if (authError) {
      return 'Authentication Failed';
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

    if (!isAuthenticationAvailable) {
      return 'Device authentication is not set up or available.';
    }

    if (authError) {
      return authError;
    }

    return 'Tap to authenticate with your device security';
  };

  // Don't render anything if security is disabled or app is unlocked
  if (!isSecurityEnabled || !isAppLocked) {
    return null;
  }

  return (
    <LinearGradient colors={gradients.blueGradient} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Logo/Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconBackground}>
              <Ionicons name={getBiometricIcon()} size={64} color="white" />
            </View>
          </View>

          {/* Title and Message */}
          <View style={styles.textContainer}>
            <ThemedText style={styles.title}>Layerz Wallet</ThemedText>
            <ThemedText style={styles.message}>{getUnlockMessage()}</ThemedText>
            <ThemedText style={styles.subMessage}>{getSubMessage()}</ThemedText>
          </View>

          {/* Action Button */}
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
                    <ThemedText style={styles.buttonText}>{showRetryButton ? 'Try Again' : 'Unlock'}</ThemedText>
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
  title: {
    fontSize: 32,
    fontWeight: '600',
    color: 'white',
    marginBottom: 16,
    textAlign: 'center',
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
    marginBottom: 32,
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
