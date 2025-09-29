import { BarcodeScanningResult, CameraType, CameraView } from 'expo-camera';
import React, { useContext, useEffect, useRef, useCallback, useState, memo } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';

import GradientFormSheet from '@/components/GradientFormSheet';
import { ThemedText } from '@/components/ThemedText';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    color: 'white',
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    margin: 64,
  },
  button: {
    flex: 1,
    alignSelf: 'flex-end',
    alignItems: 'center',
  },
  text: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
  },
});

// Memoized camera component to prevent re-renders during sheet interactions
const StableCameraView = memo<{
  facing: CameraType;
  onBarcodeScanned: (result: BarcodeScanningResult) => void;
  onCancel: () => void;
}>(({ facing, onBarcodeScanned, onCancel }) => {
  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing={facing} onBarcodeScanned={onBarcodeScanned} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} autofocus={'on'}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={onCancel}>
            <ThemedText style={styles.text}>Cancel</ThemedText>
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
});

StableCameraView.displayName = 'StableCameraView';

export default function ScanQrComponent() {
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const { handleQrScanned, dismissScanner } = useContext(ScanQrContext);
  const facing: CameraType = 'back';
  const appState = useRef(AppState.currentState);
  const hasCalledDismiss = useRef(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const isInitialized = useRef(false);

  const handleDismiss = useCallback(() => {
    if (!hasCalledDismiss.current) {
      hasCalledDismiss.current = true;
      console.debug('ScanQr: Dismissing QR scanner');
      dismissScanner();
    }
  }, [dismissScanner]);

  // Dismiss QR scanner when app goes to background
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        // App is going to background, dismiss QR scanner
        console.debug('ScanQr: App backgrounding');
        handleDismiss();
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [handleDismiss]);

  useFocusEffect(
    useCallback(() => {
      // Only initialize once per screen mount
      if (!isInitialized.current) {
        hasCalledDismiss.current = false;
        isInitialized.current = true;

        // Small delay to ensure camera initializes properly
        const timer = setTimeout(() => {
          setIsCameraReady(true);
        }, 200);

        return () => {
          clearTimeout(timer);
        };
      }

      // Only handle dismissal on actual screen unmount
      return () => {
        if (isInitialized.current) {
          console.debug('ScanQr: Screen dismissed by gesture, tap behind, or navigation');
          isInitialized.current = false;
          handleDismiss();
        }
      };
    }, [handleDismiss])
  );

  function cancelCamera() {
    handleDismiss();
    router.back();
  }

  function onBarcodeScanned(scanningResult: BarcodeScanningResult): void {
    if (!hasCalledDismiss.current) {
      hasCalledDismiss.current = true;
      handleQrScanned(scanningResult.data);
      router.back();
    }
  }

  const renderCameraContent = () => {
    if (!isCameraReady) {
      // Camera is not ready yet
      return (
        <View style={styles.container}>
          <ActivityIndicator size="large" color="white" />
          <ThemedText style={styles.message}>Preparing camera...</ThemedText>
        </View>
      );
    }

    return <StableCameraView facing={facing} onBarcodeScanned={onBarcodeScanned} onCancel={cancelCamera} />;
  };

  return <GradientFormSheet variant={network}>{renderCameraContent()}</GradientFormSheet>;
}
