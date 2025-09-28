import React, { createContext, ReactNode, useState, useRef } from 'react';
import { useRouter } from 'expo-router';

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

  /**
   * function that is exposed outside and requested by user
   */
  const scanQr = async (): Promise<string> => {
    return new Promise((resolve) => {
      // saving reference to a resolver so we can trigger it later (when we scanned qr)
      setResolverFunc(() => resolve);

      // Navigate to the QR scanner screen
      router.push('/ScanQr');
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
