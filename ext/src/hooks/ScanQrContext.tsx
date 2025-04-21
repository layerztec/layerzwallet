import { frontalCamera, QRCanvas } from '@paulmillr/qr/dom.js';
import assert from 'assert';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { LayerzStorage } from '../class/layerz-storage';
import { Button } from '../pages/Popup/DesignSystem';

interface IScanQrContext {
  scanQr: () => Promise<string>;
  isCameraPermissionGranted: () => Promise<boolean>;
  setCameraPermissionGranted: () => Promise<void>;
}

const STORAGE_KEY_CAMERA_PERMISSION_GRANTED = 'STORAGE_KEY_CAMERA_PERMISSION_GRANTED';

const isCameraPermissionGranted = async (): Promise<boolean> => {
  try {
    const result = await LayerzStorage.getItem(STORAGE_KEY_CAMERA_PERMISSION_GRANTED);
    return !!result;
  } catch (_) {}

  return false;
};

const setCameraPermissionGranted = async (): Promise<void> => {
  await LayerzStorage.setItem(STORAGE_KEY_CAMERA_PERMISSION_GRANTED, 'true');
};

const setCameraPermissionRemoved = async (): Promise<void> => {
  await LayerzStorage.setItem(STORAGE_KEY_CAMERA_PERMISSION_GRANTED, '');
};

let camera: Awaited<ReturnType<typeof frontalCamera>>;
let loopStarted = false;
let canvasQr: QRCanvas;
const fps = 20;

export const ScanQrContext = createContext<IScanQrContext>({
  scanQr: (): Promise<string> => Promise.reject('scanQr: this should never happen'),
  isCameraPermissionGranted,
  setCameraPermissionGranted,
});

type ResolverFunction = (resolveValue: string) => void;

/**
 * This provider provides an async function `scanQr()` that shows Dialog, displays camera feed, and scans for QR. The promise is
 * resolved to a string with QR code content. Also exposed helper functions `setCameraPermissionGranted`, `isCameraPermissionGranted`
 */
export const ScanQrContextProvider: React.FC<{ children: ReactNode }> = (props) => {
  const [isScanningQr, setIsScanningQr] = useState<boolean>(false);
  const [resolverFunc, setResolverFunc] = useState<ResolverFunction>(() => () => {});
  const [shouldStartScanning, setShouldStartScanning] = useState(false);
  const [error, setError] = useState<string>('');

  const _startReadingFromCamera = async () => {
    const player = document.querySelector('video');
    const overlay = document.querySelector('#overlay') as HTMLCanvasElement;
    assert(overlay, 'Internal error: overlay is null');
    assert(player, 'Internal error: video is null');

    camera = await frontalCamera(player);
    canvasQr = new QRCanvas(
      {
        overlay,
        resultQR: undefined,
      },
      { cropToSquare: false }
    );

    loopStarted = true;
    await new Promise((resolve) => setTimeout(resolve, 1000)); // propagate camera initialization
    setTimeout(readFrameIterator, 1000 / fps);
  };

  // we need this fuckery because we cant start reading from camera in scanQr: resolverFunc state is not updated in
  // react internals; maybe theres a better way to do this
  useEffect(() => {
    if (shouldStartScanning) {
      _startReadingFromCamera().catch(async (reason) => {
        if (String(reason).startsWith('NotAllowed')) {
          // most likely, camera permission was granted only once, or plain revoked.
          // lets open Options page again where user can try to obtain permissions
          await setCameraPermissionRemoved();
          await chrome.runtime.openOptionsPage();
          window.close();
        } else {
          setError(String(reason));
        }
      });
    }
    //  if i add `_startReadingFromCamera` to deps i get multiple runs of _startReadingFromCamera() which makes camera work weird
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldStartScanning, resolverFunc]);

  /**
   * function that is exposed outside and requested by user
   */
  const scanQr = async (): Promise<string> => {
    if (!(await isCameraPermissionGranted())) {
      // since its impossible to ask for camera permissions from within the popup,
      // we have to do it from an actual browser tab for some reason, thus, opening Options page where its implemented
      await chrome.runtime.openOptionsPage();
      // Close the current popup
      window.close();
      return '';
    }

    setIsScanningQr(true);

    return new Promise((resolve) => {
      // saving reference to a resolver so we can trigger it later (when we scanned qr)
      setResolverFunc(() => resolve);
      setShouldStartScanning(true); // to trigger useEffect
    });
  };

  const readFrameIterator = () => {
    if (!camera) return;

    const res = camera.readFrame(canvasQr, true);
    if (res !== undefined) {
      console.log(`Decoded "${res}"`);

      loopStarted = false;
      setTimeout(() => {
        // timeout only so that green scanned QR code stays on screen for a while for user to notice
        setIsScanningQr(false);
        resolverFunc(res);
        canvasQr?.clear();
        camera?.stop();
        // TODO: once we start supporting animated QR codes we will have to place reading them here (instead if
        //  immediately exiting loop and resolving promise)
      }, 500);
    } else {
      if (loopStarted) {
        setTimeout(readFrameIterator, 1000 / fps);
      }
    }
  };

  const onCancelClick = async () => {
    loopStarted = false;
    camera?.stop();

    setIsScanningQr(false);
    resolverFunc('');
  };

  const renderCameraFeed = () => {
    return (
      <>
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)',
            visibility: isScanningQr ? 'visible' : 'hidden',
            zIndex: 999,
          }}
        />
        <div
          style={{
            position: 'fixed',
            backgroundColor: 'white',
            visibility: isScanningQr ? 'visible' : 'hidden',
            zIndex: 1000,
            width: '50%',
            height: '50%',
            left: '25%',
            top: '25%',
            paddingLeft: 20,
            paddingTop: 20,
          }}
        >
          <span style={{ display: 'block', textAlign: 'center' }}>Place QR code in front of your webcam</span>
          {error ? <span style={{ color: 'red', display: 'block', textAlign: 'center', paddingTop: '20px' }}>Error: {error}</span> : null}
          <Button onClick={onCancelClick} style={{ position: 'absolute', bottom: '0px', left: '40%' }}>
            Cancel
          </Button>

          <div id="results-container">
            <video id="qr-video" style={{ width: '320px', height: '240px', position: 'absolute', top: '20px', left: '50px' }}></video>
            <canvas id="overlay" style={{ width: '320px', height: '240px', position: 'absolute', top: '20px', left: '50px' }}></canvas>
          </div>
        </div>
      </>
    );
  };

  return (
    <ScanQrContext.Provider value={{ scanQr, setCameraPermissionGranted, isCameraPermissionGranted }}>
      {props.children}
      {renderCameraFeed()}
    </ScanQrContext.Provider>
  );
};

export function useScanQR() {
  const { scanQr } = useContext(ScanQrContext);
  return scanQr;
}
