import { BarcodeScanningResult, CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import React, { createContext, ReactNode, useState } from 'react';
import { Button, Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface IScanQrContext {
  scanQr: () => Promise<string>;
}

export const ScanQrContext = createContext<IScanQrContext>({
  scanQr: (): Promise<string> => Promise.reject('scanQr: this should never happen'),
});

type ResolverFunction = (resolveValue: string) => void;

/**
 * This provider provides an async function `scanQr()` that shows Dialog, displays camera feed, and scans for QR. The promise is
 * resolved to a string with QR code content
 */
export const ScanQrContextProvider: React.FC<{ children: ReactNode }> = (props) => {
  const [isScanningQr, setIsScanningQr] = useState<boolean>(false);
  const [resolverFunc, setResolverFunc] = React.useState<ResolverFunction>(() => () => {});
  const facing: CameraType = 'back';
  const [permission, requestPermission] = useCameraPermissions();

  /**
   * function that is exposed outside and requested by user
   */
  const scanQr = async (): Promise<string> => {
    setIsScanningQr(true);

    return new Promise((resolve) => {
      // saving reference to a resolver so we can trigger it later (when we scanned qr)
      setResolverFunc(() => resolve);
    });
  };

  function cancelCamera() {
    setIsScanningQr(false);
    resolverFunc('');
  }

  const renderCameraFeed = () => {
    if (!permission) {
      // Camera permissions are still loading.
      return <View />;
    }

    if (!permission.granted) {
      // Camera permissions are not granted yet.
      return (
        <View style={styles.container}>
          <Text style={styles.message}>We need your permission to show the camera</Text>
          <Button onPress={requestPermission} title="grant permission" />
        </View>
      );
    }

    function onBarcodeScanned(scanningResult: BarcodeScanningResult): void {
      setIsScanningQr(false);
      resolverFunc(scanningResult.data);
    }

    return (
      <View style={styles.container}>
        <CameraView style={styles.camera} facing={facing} onBarcodeScanned={onBarcodeScanned} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} autofocus={'on'}>
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={cancelCamera}>
              <Text style={styles.text}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    );
  };

  return (
    <ScanQrContext.Provider value={{ scanQr }}>
      {props.children}
      <Modal visible={isScanningQr} animationType="slide" transparent={true} onRequestClose={cancelCamera}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>{isScanningQr && renderCameraFeed()}</View>
        </View>
      </Modal>
    </ScanQrContext.Provider>
  );
};

const { height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
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
    fontWeight: 'bold',
    color: 'white',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    height: height * 0.67, // Takes up approximately 2/3 of the screen
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
});
