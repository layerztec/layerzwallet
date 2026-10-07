#!/usr/bin/env node
/* eslint-disable no-console */
// Breez deleted the breez-sdk-liquid-react-native GitHub repo (org moved to
// the Spark SDK family), so the package's own postinstall.sh silently fails:
// its `curl` 404s, `unzip` fails, and the script still exits 0 — leaving
// android/src/main/jniLibs and build/RnBreezSdkLiquid.xcframework empty.
// Gradle then dies much later with "libbreez_sdk_liquid_bindings.so ...
// missing and no known rule to make it".
//
// This script restores the native artifacts from a local cache so fresh
// installs (including EAS *local* build sandboxes, which share the
// machine's filesystem and HOME) keep working:
//   1. $BREEZ_ARTIFACTS_DIR/<version>/{android,ios}-artifacts.zip, or
//   2. ~/.breez-artifacts/<version>/{android,ios}-artifacts.zip, or
//   3. the original GitHub release URLs (in case breez ever restores them).
// Fails LOUDLY when none of these work, so a broken install dies at
// npm-install time instead of mid-gradle.
//
// To seed the cache on a new machine, copy the two zips from a machine that
// has them (or from a node_modules that still carries the binaries — zip
// `android/src/main/jniLibs` as android-artifacts.zip and `build` as
// ios-artifacts.zip from the package root).

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pkgRoot = path.join(__dirname, '..', 'node_modules', '@breeztech', 'breez-sdk-liquid-react-native');
if (!fs.existsSync(pkgRoot)) {
  console.log('[breez-artifacts] package not installed, nothing to do');
  process.exit(0);
}
const version = require(path.join(pkgRoot, 'package.json')).version;

const androidMarker = path.join(pkgRoot, 'android', 'src', 'main', 'jniLibs', 'arm64-v8a', 'libbreez_sdk_liquid_bindings.so');
const iosMarker = path.join(pkgRoot, 'build', 'RnBreezSdkLiquid.xcframework');
if (fs.existsSync(androidMarker) && fs.existsSync(iosMarker)) {
  console.log('[breez-artifacts] native artifacts already present');
  process.exit(0);
}

const cacheDirs = [process.env.BREEZ_ARTIFACTS_DIR && path.join(process.env.BREEZ_ARTIFACTS_DIR, version), path.join(os.homedir(), '.breez-artifacts', version)].filter(Boolean);

function unzipInto(zipPath) {
  execSync(`unzip -oq ${JSON.stringify(zipPath)} -d ${JSON.stringify(pkgRoot)}`, { stdio: 'inherit' });
}

for (const dir of cacheDirs) {
  const androidZip = path.join(dir, 'android-artifacts.zip');
  const iosZip = path.join(dir, 'ios-artifacts.zip');
  if (fs.existsSync(androidZip) && fs.existsSync(iosZip)) {
    console.log(`[breez-artifacts] restoring from cache ${dir}`);
    unzipInto(androidZip);
    unzipInto(iosZip);
    break;
  }
}

if (!fs.existsSync(androidMarker) || !fs.existsSync(iosMarker)) {
  // Last resort: the package's original release URLs (dead as of 2026-10,
  // but harmless to try — breez may republish).
  const base = `https://github.com/breez/breez-sdk-liquid-react-native/releases/download/${version}`;
  for (const name of ['android-artifacts.zip', 'ios-artifacts.zip']) {
    try {
      const tmp = path.join(os.tmpdir(), name);
      execSync(`curl -fsSL ${base}/${name} --output ${JSON.stringify(tmp)}`, { stdio: 'inherit' });
      unzipInto(tmp);
      fs.rmSync(tmp, { force: true });
    } catch {
      /* fall through to the final check */
    }
  }
}

if (!fs.existsSync(androidMarker) || !fs.existsSync(iosMarker)) {
  console.error(
    `[breez-artifacts] FATAL: breez-sdk-liquid-react-native@${version} native artifacts are missing and could not be restored.\n` +
      `Seed a cache at ~/.breez-artifacts/${version}/{android-artifacts.zip,ios-artifacts.zip} (see mobile/scripts/ensure-breez-artifacts.js).`
  );
  process.exit(1);
}
console.log('[breez-artifacts] restored');
