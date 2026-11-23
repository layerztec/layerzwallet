#!/usr/bin/env node
/* global __dirname, __filename */
// @breeztech/breez-sdk-liquid-react-native ships no native code: its own postinstall downloads
// android-artifacts.zip / ios-artifacts.zip from a GitHub repo that Breez has deleted, and exits 0
// on the 404. Builds then fail with "libbreez_sdk_liquid_bindings.so ... missing" (Gradle) or
// "Undefined symbols ... _ffi_breez_sdk_liquid_bindings_*" (Xcode).
// This script fetches the same zips from the layerztec mirror, verifies sha256 and unpacks them.
//
// Two things matter for reliability:
//   1. Only the artifacts the current platform can actually use are fetched. The ios-artifacts.zip
//      is ~245 MB and is dead weight on Linux/Windows, where the iOS build cannot run anyway.
//   2. Downloads are resumable. The release CDN throttles each connection to a few hundred KB/s and
//      resets long-lived streams, so a single-shot download of a 245 MB asset fails with
//      "curl: (56) Recv failure: Connection reset by peer". We retry with `curl -C -`, which
//      continues from the bytes already on disk instead of restarting from zero.
//
// Override the artifact set with BREEZ_ARTIFACTS=android-artifacts.zip,ios-artifacts.zip.

const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MIRROR = 'https://github.com/layerztec/breez-sdk-liquid-rn-artifacts/releases/download';
const SHA256 = {
  '0.12.4': {
    'android-artifacts.zip': 'f21ca07f7eafab84f34857b9a73b4e9c69b6fc7e849c9f1d33f9f9829c288c25',
    'ios-artifacts.zip': '4329619afda394b957707188798cb92f7ef0730c262559b48cb29a0107dfa195',
  },
};

const MARKERS = {
  'android-artifacts.zip': ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'].map((abi) => `android/src/main/jniLibs/${abi}/libbreez_sdk_liquid_bindings.so`),
  'ios-artifacts.zip': [
    'build/RnBreezSdkLiquid.xcframework/Info.plist',
    'build/RnBreezSdkLiquid.xcframework/ios-arm64/libbreez_sdk_liquid_bindings.a',
    'build/RnBreezSdkLiquid.xcframework/ios-arm64_x86_64-simulator/libbreez_sdk_liquid_bindings.a',
  ],
};

// iOS builds require macOS + Xcode, so the ios artifacts are only ever needed on darwin.
// Android artifacts are needed everywhere an Android build can run, i.e. everywhere but a
// darwin-only-iOS setup -- and since Android builds also run on macOS, keep them everywhere.
const DEFAULT_ARTIFACTS = process.platform === 'darwin' ? ['android-artifacts.zip', 'ios-artifacts.zip'] : ['android-artifacts.zip'];

function selectedArtifacts() {
  const override = process.env.BREEZ_ARTIFACTS;
  if (!override) return DEFAULT_ARTIFACTS;
  const names = override
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);
  const unknown = names.filter((n) => !(n in SHA256[version]));
  if (unknown.length) {
    console.error(`[breez-artifacts] unknown artifact(s) in BREEZ_ARTIFACTS: ${unknown.join(', ')}`);
    process.exit(1);
  }
  return names;
}

const pkgRoot = path.join(__dirname, '..', 'node_modules', '@breeztech', 'breez-sdk-liquid-react-native');
const version = require(path.join(pkgRoot, 'package.json')).version;

if (!SHA256[version]) {
  console.error(`[breez-artifacts] no sha256 pinned for ${version}; upload the zips to ${MIRROR}/${version} and add their hashes to ${path.basename(__filename)}`);
  process.exit(1);
}

// Cache the zips outside node_modules so a re-run (or a failed run) does not re-download 245 MB.
const cacheDir = path.join(__dirname, '..', '.cache', 'breez-artifacts', version);

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function markersPresent(name) {
  return MARKERS[name].every((m) => fs.existsSync(path.join(pkgRoot, m)));
}

// Download with resume: `curl -C -` picks up where the previous attempt stopped, so a connection
// reset costs us a few seconds, not the whole file.
function download(url, dest) {
  const attempts = 12;
  for (let i = 1; i <= attempts; i++) {
    const res = spawnSync('curl', ['-fsSL', '-C', '-', '--retry', '5', '--retry-all-errors', '--retry-delay', '2', '--connect-timeout', '30', '-o', dest, url], {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    if (res.status === 0) return true;
    const size = fs.existsSync(dest) ? fs.statSync(dest).size : 0;
    console.log(`[breez-artifacts] download attempt ${i}/${attempts} interrupted (exit ${res.status}), ${size} bytes on disk, resuming`);
  }
  return false;
}

const artifacts = selectedArtifacts();

const missing = artifacts.filter((name) => !markersPresent(name));
if (!missing.length) {
  console.log(`[breez-artifacts] ${version} native artifacts already present`);
  process.exit(0);
}

fs.mkdirSync(cacheDir, { recursive: true });

for (const name of missing) {
  const expected = SHA256[version][name];
  const url = `${MIRROR}/${version}/${name}`;
  const zip = path.join(cacheDir, name);

  if (fs.existsSync(zip) && sha256(zip) === expected) {
    console.log(`[breez-artifacts] ${name} already downloaded and verified`);
  } else {
    console.log(`[breez-artifacts] downloading ${name} from ${MIRROR}/${version}`);
    // Two passes: the first resumes a partial file, the second starts from scratch in case the
    // resumed bytes turned out to be corrupt (sha256 mismatch).
    for (let pass = 1; pass <= 2; pass++) {
      if (pass === 2) {
        console.log(`[breez-artifacts] re-downloading ${name} from scratch`);
        fs.rmSync(zip, { force: true });
      }
      if (!download(url, zip)) {
        console.error(`[breez-artifacts] failed to download ${name}`);
        process.exit(1);
      }
      const actual = sha256(zip);
      if (actual === expected) break;
      console.error(`[breez-artifacts] sha256 mismatch for ${name}: expected ${expected}, got ${actual}`);
      if (pass === 2) {
        fs.rmSync(zip, { force: true });
        process.exit(1);
      }
    }
  }

  execUnzip(zip);
}

function execUnzip(zip) {
  const res = spawnSync('unzip', ['-oq', zip, '-d', pkgRoot], { stdio: 'inherit' });
  if (res.status !== 0) {
    console.error(`[breez-artifacts] unzip failed for ${path.basename(zip)}`);
    process.exit(1);
  }
}

const stillMissing = artifacts.filter((name) => !markersPresent(name));
if (stillMissing.length) {
  const details = stillMissing.flatMap((name) => MARKERS[name].filter((m) => !fs.existsSync(path.join(pkgRoot, m))).map((m) => `${name}: ${m}`));
  console.error(`[breez-artifacts] still missing after unpack: ${details.join(', ')}`);
  process.exit(1);
}
console.log('[breez-artifacts] restored');
