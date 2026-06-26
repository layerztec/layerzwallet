# Layerz Wallet

Experience the future of Bitcoin with Layer2-focused wallet. Bitcoin-only, non-custodial, opensource.

* Mobile apps (iOS/Android)
* Browser extension
* Desktop apps (macOS/Linux/Windows)

> **Developer Preview Release**
> This is an early access version for developers. Use with caution and report any issues you encounter.

## L2s supported (current and upcoming)

- [x] Bitcoin base layer
- [x] Rootstock
- [x] Citrea (testnet)
- [x] Alpen (testnet)
- [x] Liquid & Liquid assets
- [x] Ark (by ArkLabs) (testnet)
- [x] Spark
- [ ] RGB
- [x] Lightning (breez-nodeless)
- [ ] Taproot assets

## Other features (current and upcoming)

- [ ] Hardware wallet support (single-sig & multi-sig)
- [X] Code opensourced
- [ ] Bridging from base layer to Layer 2
- [ ] Swaps between Layers

# Project structure

This is a monorepo with 3 subprojects, `mobile/`, `ext/` & `desktop/`. Mobile app is built with React Native (Expo), Extension is built with React, and the Desktop app is built with [Electrobun](https://electrobun.dev) (Bun runtime) + Vite/React.
Shared code (anything that can be reused, cryptography, network fetchers, react hooks) are shared in `shared/`


## Installing and Running (ext)


- Run `npm install` to install the dependencies.
- Run `npm start`
- Load your extension on Chrome following:
  1.  Access `chrome://extensions/`
  2.  Check `Developer mode`
  3.  Click on `Load unpacked extension`
  4.  Select the `build` folder.

## Installing and Running (mobile)

- Run `npm install` to install the dependencies.
- Run `npm start`
- Use Dev build to scan QR code from terminal

Development build for android (produces apk that has to load bundle remotely): `eas build --platform android --profile development-simulator --local`

## Installing and Running (desktop)

The desktop app uses [Bun](https://bun.sh) (see `desktop/bun.lock`), not npm.

- Run `bun install` to install the dependencies.
- Run `bun start` to build the views (Vite) and launch the app (`electrobun dev`).
- Run `bun run dev` for a watch-mode dev build.

> On Linux the app bundles CEF (Chromium Embedded Framework) instead of WebKitGTK, which is weak for the WASM-heavy wallet UI.

## Tests

TBD

## e2e (ext)

- `npx playwright install`
- `npx playwright install-deps`
- `./utils/add-sepolia.sh`
- `npm run build`
- `npm run e2e`

## e2e (mobile)

We are using Maestro since it's the only recommended option for Expo EAS. Test flows are located in `mobile/.maestro/`.

On pull requests, Android and iOS Maestro E2E workflows run only after you add the GitHub label **`run-mobile-e2e`**. New commits do not re-trigger E2E until you remove and re-apply the label (or run `eas workflow:run` manually from `mobile/`).
We are also relying on Expo EAS for builds, so a generic workflow to run e2e tests on USB-connected Android device would be:

- get a list of builds from EAS: `eas build:list` (optionally trigger the build manually first: `eas build --platform android --profile preview --message="debug smth" --no-wait`)
- Note the `Artifacts` field, and download the one you need: `wget https://expo.dev/artifacts/eas/example.apk`
- make sure Android device is connected and in dev mode, then install the apk: `adb install example.apk`
- run the tests `npm run e2e` (from `mobile/` dir)


## Build

* local android build: `eas build --platform android --profile preview --local`
* ext build: `npm run build`
* desktop build: `bun run build` (from `desktop/`) — runs Vite + `electrobun build --env=stable`, emitting distributables to `desktop/artifacts/`.

Electrobun only builds for the host platform/arch, so desktop distributables are produced in CI on a runner per OS: the `desktop-build-macos` (arm64), `desktop-build-linux` (x64), and `desktop-build-windows` (x64) jobs in `.github/workflows/build.yml` run `bun run build` and upload the `artifacts/` folder.

### Store submits (EAS Workflows)

Production builds and store submission run automatically on pushes to **`master`** via `mobile/.eas/workflows/submit-android.yml` (Play Store + release APK) and `submit-ios.yml` (TestFlight). They run **only when that push changes files under `mobile/`**; merges that touch only `ext/`, `shared/`, docs, etc. do not trigger them.

To submit without a `mobile/` change (or to re-run after a skipped push), from `mobile/`:

```
eas workflow:run .eas/workflows/submit-android.yml
eas workflow:run .eas/workflows/submit-ios.yml
```

## iOS Dev Client (TestFlight)

A separate iOS app record exists on App Store Connect for distributing an
Expo Dev Client build via TestFlight (bundle id `com.layerzwallet.mobile.devclient`,
ASC app id `6762009368`). The binary is signed as a regular App Store build but
embeds `expo-dev-client`, so once installed from TestFlight it can load any
branch's JS bundle remotely from `expo start --dev-client`.

The bundle id is swapped at prebuild time via the `APP_VARIANT=devclient`
env var (see `mobile/app.config.js`); the production app's identity is
unaffected.

Build remotely on EAS and auto-submit to TestFlight in one shot:

```
cd mobile
eas build --platform ios --profile development-device-ios --auto-submit-with-profile=devclient
```

Or in two steps if you want to inspect the build first:

```
eas build --platform ios --profile development-device-ios
eas submit --platform ios --profile devclient --latest
```

Credentials (distribution cert + provisioning profile) are managed by EAS;
first run will prompt for an Apple ID and create them automatically.
