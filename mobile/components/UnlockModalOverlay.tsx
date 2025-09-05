import React, { useContext, useEffect, useState } from 'react';
import { LayoutAnimation, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

import { ThemedText } from '@/components/ThemedText';
import GradientScreen from '@/components/GradientScreen';
import { useAppLock } from '@/src/hooks/useAppLock';
import { NetworkContext } from '@shared/hooks/NetworkContext';

export default function UnlockModalOverlay() {
  const { network } = useContext(NetworkContext);
  const { lockState, authenticateWithBiometrics, clearCanceled } = useAppLock();
  const [hasAutoTriggered, setHasAutoTriggered] = useState(false);

  useEffect(() => {
    LayoutAnimation.configureNext({
      duration: 300,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
  }, [lockState.isAuthenticating, lockState.userCanceled, hasAutoTriggered]);

  useEffect(() => {
    if (lockState.isLocked && lockState.requiresAuth && !lockState.isAuthenticating && !lockState.userCanceled && !hasAutoTriggered) {
      setHasAutoTriggered(true);
      authenticateWithBiometrics();
    }

    if (!lockState.isLocked) {
      setHasAutoTriggered(false);
    }
  }, [lockState.isLocked, lockState.requiresAuth, lockState.isAuthenticating, lockState.userCanceled, hasAutoTriggered, authenticateWithBiometrics]);

  const handleUnlockPress = () => {
    LayoutAnimation.configureNext({
      duration: 200,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
    clearCanceled();
    authenticateWithBiometrics();
  };

  const isVisible = lockState.isLocked && lockState.requiresAuth;

  return (
    <Modal visible={isVisible} animationType="none" presentationStyle="fullScreen">
      <GradientScreen variant={network}>
        <View style={styles.container}>
          <BlurView intensity={50} tint="dark" style={styles.blur}>
            <View style={styles.content}>
              <View style={styles.iconContainer}>
                <MaterialIcons name="lock" size={80} color="rgba(255, 255, 255, 0.8)" />
              </View>
              <ThemedText style={styles.title}>Wallet Locked</ThemedText>
              <ThemedText style={styles.subtitle}>
                {lockState.isAuthenticating
                  ? 'Authenticating...'
                  : lockState.userCanceled
                    ? 'Authentication was canceled. Tap unlock to try again.'
                    : hasAutoTriggered
                      ? 'Tap unlock to authenticate'
                      : 'Authenticating automatically...'}
              </ThemedText>
              {!lockState.isAuthenticating && (lockState.userCanceled || hasAutoTriggered) && (
                <TouchableOpacity style={styles.unlockButton} onPress={handleUnlockPress} testID="UnlockButton">
                  <MaterialIcons name="fingerprint" size={24} color="rgba(255, 255, 255, 0.8)" />
                  <ThemedText style={styles.unlockButtonText}>Unlock</ThemedText>
                </TouchableOpacity>
              )}
            </View>
          </BlurView>
        </View>
      </GradientScreen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  blur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  iconContainer: {
    marginBottom: 20,
    transform: [{ scale: 1 }],
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  unlockButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
});
