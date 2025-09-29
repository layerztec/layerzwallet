import React, { createContext, ReactNode, useState, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useCameraPermissions } from 'expo-camera';
import { Alert } from 'react-native';

interface IScanQrContext {
  scanQr: () => Promise<string>;
  dismissScanner: () => void;
  handleQrScanned: (data: string) => void;
}

export const ScanQrContext = createContext<IScanQrContext>({
  scanQr: (): Promise<string> => Promise.reject('scanQr: this should never happen'),
  dismissScanner: (): void => {},
  handleQrScanned: (): void => {},
});

type ResolverFunction = (resolveValue: string) => void;

/**
 * This provider provides an async function `scanQr()` that shows Dialog, displays camera feed, and scans for QR. The promise is
 * resolved to a string with QR code content
 */
export const ScanQrContextProvider: React.FC<{ children: ReactNode }> = (props) => {
  const router = useRouter();
  const [resolverFunc, setResolverFunc] = useState<ResolverFunction>(() => () => {});
  const [permission, requestPermission] = useCameraPermissions();

  /**
   * function that is exposed outside and requested by user
   */
  const scanQr = async (): Promise<string> => {
    return new Promise(async (resolve) => {
      // saving reference to a resolver so we can trigger it later (when we scanned qr)
      setResolverFunc(() => resolve);

      // Check and request camera permissions before showing the scanner
      try {
        if (!permission) {
          // Permissions are still loading
          console.debug('ScanQr: Camera permissions loading...');
          resolve('');
          return;
        }

        if (!permission.granted) {
          console.debug('ScanQr: Requesting camera permission...');
          const permissionResult = await requestPermission();

          if (!permissionResult.granted) {
            console.debug('ScanQr: Camera permission denied');
            Alert.alert('Camera Permission Required', 'Please allow camera access to scan QR codes. You can enable this in your device settings.', [{ text: 'OK' }]);
            resolve('');
            return;
          }
        }

        // Permissions are granted, navigate to the QR scanner screen
        console.debug('ScanQr: Camera permission granted, opening scanner');
        router.push('/ScanQr');
      } catch (error) {
        console.error('ScanQr: Error requesting camera permission:', error);
        Alert.alert('Camera Error', 'Unable to access camera. Please try again.', [{ text: 'OK' }]);
        resolve('');
      }
    });
  };

  /**
   * Function called by the QR scanner screen when a QR code is scanned
   */
  const handleQrScanned = (data: string): void => {
    resolverFunc(data);
  };

  /**
   * Function to dismiss the scanner and resolve with empty string
   */
  const dismissScanner = (): void => {
    resolverFunc('');
  };

  return <ScanQrContext.Provider value={{ scanQr, dismissScanner, handleQrScanned }}>{props.children}</ScanQrContext.Provider>;
};
