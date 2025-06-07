// Custom entry point for LayerZ Wallet mobile app
// This replaces expo-router/entry to includ necessary polyfills

// Import the expo-router entry point
import 'expo-router/entry-classic';

let Buffer = require('buffer/').Buffer;
global.Buffer = Buffer;
