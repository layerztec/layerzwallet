// Custom entry point for LayerZ Wallet mobile app
// This replaces expo-router/entry to include necessary polyfills

 
import 'react-native-get-random-values';

 
import Bugsnag from '@bugsnag/expo';

// should be last
// @see https://docs.expo.dev/router/installation/
 
import 'expo-router/entry';

let Buffer = require('buffer/').Buffer;
global.Buffer = Buffer;

const BUGSNAG_API_KEY = process.env.EXPO_PUBLIC_BUGSNAG_API_KEY;

if (BUGSNAG_API_KEY) {
  Bugsnag.start({
    apiKey: BUGSNAG_API_KEY,
  });
}