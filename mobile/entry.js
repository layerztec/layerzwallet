// Custom entry point for LayerZ Wallet mobile app
// This replaces expo-router/entry to include necessary polyfills

import 'react-native-get-random-values';

import Bugsnag from '@bugsnag/expo';
import { AnalyticsEvents, initializeAnalytics, trackAnalyticsEvent } from './src/modules/analytics';
import { getDeviceIdentifier } from './src/utils/device-id';
import { isMaestroMode } from './src/hooks/AuthStateContext';
import { handleError } from './src/modules/error-handler';

let Buffer = require('buffer/').Buffer;
global.Buffer = Buffer;
global.process = require('process');

const APTABASE_APP_KEY = process.env.EXPO_PUBLIC_APTABASE_KEY;
const BUGSNAG_API_KEY = process.env.EXPO_PUBLIC_BUGSNAG_API_KEY;

if (APTABASE_APP_KEY && !isMaestroMode()) {
  initializeAnalytics(APTABASE_APP_KEY);
  trackAnalyticsEvent(AnalyticsEvents.AppStarted, {});
} else {
  console.warn('Analytics not started');
}

if (BUGSNAG_API_KEY && !isMaestroMode()) {
  // Initialize Bugsnag with device identifier
  getDeviceIdentifier()
    .then((deviceId) => {
      console.debug('Initializing Bugsnag with device ID:', deviceId);
      Bugsnag.start({
        apiKey: BUGSNAG_API_KEY,
        user: {
          id: deviceId,
        },
      });
      console.debug('Bugsnag initialized successfully');
    })
    .catch((error) => {
      handleError(error, 'entry.js');
      console.error('Failed to get device identifier, Bugsnag not initialized:', error);
    });
} else {
  if (isMaestroMode()) {
    console.debug('Bugsnag disabled for e2e/Maestro test mode');
  } else if (!BUGSNAG_API_KEY) {
    console.warn('Bugsnag API key not found');
  }
}

// should be last
// @see https://docs.expo.dev/router/installation/
// eslint-disable-next-line import/first
import 'expo-router/entry';