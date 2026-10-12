#!/usr/bin/env node
/* global __dirname, __filename */
// @breeztech/breez-sdk-liquid-react-native ships no native code: its own postinstall downloads
// android-artifacts.zip / ios-artifacts.zip from a GitHub repo that Breez has deleted, and exits 0
// on the 404. Builds then fail with "libbreez_sdk_liquid_bindings.so ... missing" (Gradle) or
// "Undefined symbols ... _ffi_breez_sdk_liquid_bindings_*" (Xcode).
// This script fetches the same zips from the layerztec mirror, verifies sha256 and unpacks them.

const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MIRROR = 'https://github.com/layerztec/breez-sdk-liquid-rn-artifacts/releases/download';
const SHA256 = {
  '0.12.4': {
    'android-artifacts.zip': 'f21ca07f7eafab84f34857b9a73b4e9c69b6fc7e849c9f1d33f9f9829c288c25',
    'ios-artifacts.zip': '4329619afda394b957707188798cb92f7ef0730c262559b48cb29a0107dfa195',
  },
};

const pkgRoot = path.join(__dirname, '..', 'node_modules', '@breeztech', 'breez-sdk-liquid-react-native');
const version = require(path.join(pkgRoot, 'package.json')).version;
const markers = [
  ...['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'].map((abi) => `android/src/main/jniLibs/${abi}/libbreez_sdk_liquid_bindings.so`),
  'build/RnBreezSdkLiquid.xcframework/Info.plist',
  'build/RnBreezSdkLiquid.xcframework/ios-arm64/libbreez_sdk_liquid_bindings.a',
  'build/RnBreezSdkLiquid.xcframework/ios-arm64_x86_64-simulator/libbreez_sdk_liquid_bindings.a',
].map((m) => path.join(pkgRoot, m));

if (markers.every((m) => fs.existsSync(m))) {
  console.log(`[breez-artifacts] ${version} native artifacts already present`);
  process.exit(0);
}
if (!SHA256[version]) {
  console.error(`[breez-artifacts] no sha256 pinned for ${version}; upload the zips to ${MIRROR}/${version} and add their hashes to ${path.basename(__filename)}`);
  process.exit(1);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'breez-artifacts-'));
try {
  const zips = Object.keys(SHA256[version]);
  console.log(`[breez-artifacts] downloading ${zips.join(', ')} from ${MIRROR}/${version}`);
  execFileSync('curl', ['-fsSL', '--retry', '3', '--parallel', ...zips.flatMap((name) => [`${MIRROR}/${version}/${name}`, '--output', path.join(tmp, name)])], { stdio: 'inherit' });
  for (const [name, expected] of Object.entries(SHA256[version])) {
    const zip = path.join(tmp, name);
    const actual = crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
    if (actual !== expected) throw new Error(`sha256 mismatch for ${name}: expected ${expected}, got ${actual}`);
    execFileSync('unzip', ['-oq', zip, '-d', pkgRoot], { stdio: 'inherit' });
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
const missing = markers.filter((m) => !fs.existsSync(m));
if (missing.length) {
  console.error(`[breez-artifacts] still missing after unpack: ${missing.join(', ')}`);
  process.exit(1);
}
console.log('[breez-artifacts] restored');
