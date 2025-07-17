// Custom entry point for LayerZ Wallet mobile app
// This replaces expo-router/entry to include necessary polyfills

let Buffer = require('buffer/').Buffer;
global.Buffer = Buffer;

import 'react-native-get-random-values';

// should be last
// @see https://docs.expo.dev/router/installation/
import 'expo-router/entry';