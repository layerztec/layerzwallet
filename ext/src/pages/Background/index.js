import '../../modules/breeze-adapter';
import { handleMessage } from '../../modules/background-message-controller';
import Bugsnag from '@bugsnag/js';
import { getDeviceID } from '@shared/modules/device-id';
import { LayerzStorage } from '../../class/layerz-storage';
import { Csprng } from '../../class/rng';
import { isPlaywrightMode } from '../../utils/playwright-detection';

const BUGSNAG_API_KEY = process.env.EXPO_PUBLIC_BUGSNAG_API_KEY;

if (BUGSNAG_API_KEY && !isPlaywrightMode()) {
  getDeviceID(LayerzStorage, Csprng)
    .then((deviceId) => {
      console.debug('Initializing Bugsnag with device ID:', deviceId);
      Bugsnag.start({
        apiKey: BUGSNAG_API_KEY,
        appType: 'browser-extension',
        user: {
          id: deviceId,
        },
        metadata: {
          platform: {
            type: 'browser-extension',
            browser: navigator.userAgent,
          },
        },
      });
      console.debug('Bugsnag initialized successfully');
    })
    .catch((error) => {
      console.error('Failed to get device identifier, Bugsnag not initialized:', error);
    });
} else {
  if (isPlaywrightMode()) {
    console.debug('Bugsnag disabled for Playwright test mode');
  } else if (!BUGSNAG_API_KEY) {
    console.warn('Bugsnag API key not found');
  }
}

console.log('LZ background script running...');
chrome.runtime.onMessage.addListener(handleMessage);
