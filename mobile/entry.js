// Custom entry point for LayerZ Wallet mobile app
// This replaces expo-router/entry to include necessary polyfills

import 'react-native-get-random-values';

import Bugsnag from '@bugsnag/expo';
import { getDeviceIdentifier } from './src/utils/device-id';

let Buffer = require('buffer/').Buffer;
global.Buffer = Buffer;

const BUGSNAG_API_KEY = process.env.EXPO_PUBLIC_BUGSNAG_API_KEY;

if (BUGSNAG_API_KEY) {
  // Initialize Bugsnag with device identifier
  getDeviceIdentifier().then((deviceId) => {
    console.log('Initializing Bugsnag with device ID:', deviceId);
    Bugsnag.start({
      apiKey: BUGSNAG_API_KEY,
      user: {
        id: deviceId,
      },
    });
    console.log('Bugsnag initialized successfully');
  }).catch((error) => {
    console.error('Failed to initialize Bugsnag:', error);
  });
} else {
  console.warn('Bugsnag API key not found');
}

// should be last
// @see https://docs.expo.dev/router/installation/
// eslint-disable-next-line import/first
import 'expo-router/entry';