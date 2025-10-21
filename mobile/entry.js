// Custom entry point for LayerZ Wallet mobile app
// This replaces expo-router/entry to include necessary polyfills

import 'react-native-get-random-values';

import Bugsnag from '@bugsnag/expo';
import { Platform } from 'react-native';
import { getDeviceIdentifier } from './src/utils/device-id';
import { isMaestroMode } from './src/hooks/AuthStateContext';

let Buffer = require('buffer/').Buffer;
global.Buffer = Buffer;

const BUGSNAG_API_KEY = process.env.EXPO_PUBLIC_BUGSNAG_API_KEY;

if (BUGSNAG_API_KEY && !isMaestroMode()) {
  // Initialize Bugsnag with device identifier
  getDeviceIdentifier()
    .then((deviceId) => {
      console.debug('Initializing Bugsnag with device ID:', deviceId);
      Bugsnag.start({
        apiKey: BUGSNAG_API_KEY,
        appType: 'mobile-app',
        user: {
          id: deviceId,
        },
        metadata: {
          platform: {
            type: 'mobile-app',
            os: Platform.OS,
          },
        },
      });
      console.debug('Bugsnag initialized successfully');
    })
    .catch((error) => {
      console.error('Failed to get device identifier, Bugsnag not initialized:', error);
    });
} else {
  if (isMaestroMode()) {
    console.debug('Bugsnag disabled for e2e/Maestro test mode');
  }
}

// should be last
// @see https://docs.expo.dev/router/installation/
// eslint-disable-next-line import/first
import 'expo-router/entry';