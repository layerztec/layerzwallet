# Layerz Wallet

Experience the future of Bitcoin with Layer2-focused wallet. Bitcoin-only, non-custodial, opensource.

* Mobile apps (iOS/Android)
* Browser extension

> **Developer Preview Release**
> This is an early access version for developers. Use with caution and report any issues you encounter.

## L2s supported (current and upcoming)

- [x] Bitcoin base layer
- [x] Rootstock
- [x] Botanix (testnet)
- [x] Citrea (testnet)
- [x] Strata (testnet)
- [ ] Liquid & Liquid assets
- [x] Ark (by ArkLabs) (testnet)
- [ ] RGB
- [ ] Lightning & Taproot assets

## Other features (current and upcoming)

- [ ] Hardware wallet support (single-sig & multi-sig)
- [X] Code opensourced
- [ ] Bridging from base layer to Layer 2
- [ ] Swaps between Layers

# Project structure

This is a monorepo with 2 subprojects, `mobile/` & `ext/`. Mobile app is built with React Native (Expo), Extension is built with React.
Shared code (anything thah can be reused, cryptography, network fetchers, react hooks) are shared in `shared/`


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
- Use Expo Go to scan QR code from terminal

Development build for android (produces apk that has to load bundle remotely): `eas build --platform android --profile development-simulator --local`

## Tests

TBD

## e2e (ext)

- `npx playwright install`
- `npx playwright install-deps`
- `./utils/add-sepolia.sh`
- `npm run e2e`

## e2e (mobile)

We are using Maestro since it's the only recommended option for Expo EAS. Test flows are located in `mobile/.maestro/`.
We are also relying on Expo EAS for builds, so a generic workflow to run e2e tests on USB-connected Android device would be:

- get a list of builds from EAS: `eas build:list` (optionally trigger the build manually first: `eas build --platform android --profile preview --message="debug smth" --no-wait`)
- Note the `Artifacts` field, and download the one you need: `wget https://expo.dev/artifacts/eas/example.apk`
- make sure Android device is connected and in dev mode, then install the apk: `adb install example.apk`
- run the tests `npm run e2e` (from `mobile/` dir)