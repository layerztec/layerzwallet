import { BarcodeScanningResult, CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import React, { useContext, useEffect, useRef, useCallback } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, Button, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';

import GradientFormSheet from '@/components/GradientFormSheet';
import { ThemedText } from '@/components/ThemedText';
import { ScanQrContext } from '@/src/hooks/ScanQrContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';

export default function ScanQrComponent() {
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const { handleQrScanned, dismissScanner } = useContext(ScanQrContext);
  const facing: CameraType = 'back';
  const [permission, requestPermission] = useCameraPermissions();
  const appState = useRef(AppState.currentState);
  const hasCalledDismiss = useRef(false);

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
      hasCalledDismiss.current = false;

      return () => {
        console.debug('ScanQr: Screen dismissed by gesture, tap behind, or navigation');
        handleDismiss();
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
    if (!permission) {
      // Camera permissions are still loading.
      return <ActivityIndicator />;
    }

    if (!permission.granted) {
      // Camera permissions are not granted yet.
      return (
        <View style={styles.container}>
          <ThemedText style={styles.message}>We need your permission to show the camera</ThemedText>
          <Button onPress={requestPermission} title="grant permission" />
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <CameraView style={styles.camera} facing={facing} onBarcodeScanned={onBarcodeScanned} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} autofocus={'on'}>
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={cancelCamera}>
              <ThemedText style={styles.text}>Cancel</ThemedText>
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    );
  };

  return <GradientFormSheet variant={network}>{renderCameraContent()}</GradientFormSheet>;
}

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
