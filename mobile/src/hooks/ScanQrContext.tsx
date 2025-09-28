import { BarcodeScanningResult, CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import React, { createContext, ReactNode, useState, useEffect, useRef } from 'react';
import { Button, Dimensions, Modal, StyleSheet, TouchableOpacity, View, AppState, AppStateStatus } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PlatformBlurView from '@/components/PlatformBlurView';

interface IScanQrContext {
  scanQr: () => Promise<string>;
  dismissScanner: () => void;
}

export const ScanQrContext = createContext<IScanQrContext>({
  scanQr: (): Promise<string> => Promise.reject('scanQr: this should never happen'),
  dismissScanner: (): void => {},
});

type ResolverFunction = (resolveValue: string) => void;

/**
 * This provider provides an async function `scanQr()` that shows Dialog, displays camera feed, and scans for QR. The promise is
 * resolved to a string with QR code content
 */
export const ScanQrContextProvider: React.FC<{ children: ReactNode }> = (props) => {
  const [isScanningQr, setIsScanningQr] = useState<boolean>(false);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [resolverFunc, setResolverFunc] = React.useState<ResolverFunction>(() => () => {});
  const facing: CameraType = 'back';
  const [permission, requestPermission] = useCameraPermissions();
  const appState = useRef(AppState.currentState);
  const insets = useSafeAreaInsets();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * function that is exposed outside and requested by user
   */
  const scanQr = async (): Promise<string> => {
    setIsScanningQr(true);
    setIsModalVisible(true);

    return new Promise((resolve) => {
      // saving reference to a resolver so we can trigger it later (when we scanned qr)
      setResolverFunc(() => resolve);
    });
  };

  function cancelCamera() {
    setIsScanningQr(false);
    resolverFunc('');
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Add a small delay before hiding the modal to prevent flicker
    timeoutRef.current = setTimeout(() => {
      setIsModalVisible(false);
    }, 150);
  }

  // Dismiss QR scanner when app goes to background
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        // App is going to background, dismiss QR scanner if active
        if (isScanningQr) {
          console.debug('ScanQrContext: Dismissing QR scanner due to app backgrounding');
          setIsScanningQr(false);
          resolverFunc('');
          timeoutRef.current = setTimeout(() => {
            setIsModalVisible(false);
          }, 150);
        }
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isScanningQr, resolverFunc]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const renderCameraFeed = () => {
    if (!permission) {
      // Camera permissions are still loading.
      return <View />;
    }

    if (!permission.granted) {
      // Camera permissions are not granted yet.
      return (
        <View style={styles.container}>
          <TouchableOpacity 
            style={[styles.closeButton, { top: insets.top + 10 }]} 
            onPress={cancelCamera}
            testID="CloseCameraButton"
          >
            <PlatformBlurView 
              intensity={80} 
              tint="dark" 
              style={styles.closeButtonBlur}
            >
              <Ionicons name="close" size={24} color="white" />
            </PlatformBlurView>
          </TouchableOpacity>
          <View style={styles.permissionContainer}>
            <ThemedText style={styles.message}>We need your permission to show the camera</ThemedText>
            <Button onPress={requestPermission} title="Grant Permission" />
          </View>
        </View>
      );
    }

    function onBarcodeScanned(scanningResult: BarcodeScanningResult): void {
      setIsScanningQr(false);
      resolverFunc(scanningResult.data);
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Add a small delay before hiding the modal to prevent flicker
      timeoutRef.current = setTimeout(() => {
        setIsModalVisible(false);
      }, 150);
    }

    return (
      <View style={styles.container}>
        <CameraView style={styles.camera} facing={facing} onBarcodeScanned={onBarcodeScanned} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} autofocus={'on'}>
          {/* Close button in top right corner */}
          <TouchableOpacity 
            style={[styles.closeButton, { top: insets.top + 10 }]} 
            onPress={cancelCamera}
            testID="CloseCameraButton"
          >
            <PlatformBlurView 
              intensity={80} 
              tint="dark" 
              style={styles.closeButtonBlur}
            >
              <Ionicons name="close" size={24} color="white" />
            </PlatformBlurView>
          </TouchableOpacity>
        </CameraView>
      </View>
    );
  };

  return (
    <ScanQrContext.Provider value={{ scanQr, dismissScanner: cancelCamera }}>
      {props.children}
      <Modal visible={isModalVisible} animationType="slide" transparent={false} onRequestClose={cancelCamera}>
        <View style={styles.modalContainer}>
          {isScanningQr ? renderCameraFeed() : <View style={styles.container} />}
        </View>
      </Modal>
    </ScanQrContext.Provider>
  );
};

const { height } = Dimensions.get('window');

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  container: {
    flex: 1,
    backgroundColor: 'black',
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
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
});
