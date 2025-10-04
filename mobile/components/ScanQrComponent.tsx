import { BarcodeScanningResult, CameraType, CameraView } from 'expo-camera';
import React, { useContext, useEffect, useRef, useCallback, useState, memo } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

import GradientFormSheet from '@/components/GradientFormSheet';
import PlatformBlurView from '@/components/PlatformBlurView';
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
  closeButton: {
    position: 'absolute',
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    zIndex: 1000,
  },
  closeButtonBlur: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// Memoized camera component to prevent re-renders during sheet interactions
const StableCameraView = memo<{
  facing: CameraType;
  onBarcodeScanned: (result: BarcodeScanningResult) => void;
  onCancel: () => void;
  insets: { top: number; right: number; bottom: number; left: number };
}>(({ facing, onBarcodeScanned, onCancel, insets }) => {
  const panGesture = Gesture.Pan()
    .onEnd((event) => {
      if (event.translationY > 150 && event.velocityY > 500) {
        onCancel();
      }
    })
    .runOnJS(true);

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.container}>
        <CameraView style={styles.camera} facing={facing} onBarcodeScanned={onBarcodeScanned} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} autofocus={'on'} />
        {/* Close button in top right corner - positioned absolutely outside CameraView */}
        <TouchableOpacity style={[styles.closeButton, { top: insets.top + 10 }]} onPress={onCancel} testID="CloseCameraButton">
          <PlatformBlurView intensity={80} tint="dark" style={styles.closeButtonBlur}>
            <Ionicons name="close" size={24} color="white" />
          </PlatformBlurView>
        </TouchableOpacity>
      </View>
    </GestureDetector>
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
  const insets = useSafeAreaInsets();

  const handleDismiss = useCallback(() => {
    if (!hasCalledDismiss.current) {
      hasCalledDismiss.current = true;
      console.debug('ScanQr: Dismissing QR scanner');
      dismissScanner();
      router.back();
    }
  }, [dismissScanner, router]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
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

    return <StableCameraView facing={facing} onBarcodeScanned={onBarcodeScanned} onCancel={cancelCamera} insets={insets} />;
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GradientFormSheet variant={network}>{renderCameraContent()}</GradientFormSheet>
    </GestureHandlerRootView>
  );
}
