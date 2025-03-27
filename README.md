# Layerz Wallet

Experience the future of Bitcoin with Layer2-focused wallet. Bitcoin-only, non-custodial, opensource.

* Mobile apps (iOS/Android)
* Browser extension

🌐 [https://layerzwallet.com](https://layerzwallet.com)

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

This is a monorepo with 2 subprojects, `mobile/` & `ext/`. Mobile app is buit with React Native (Expo), Extension is built with React.
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

## Tests

TBD

## e2e (ext)

- `npx playwright install`
- `npx playwright install-deps`
- `./utils/add-sepolia.sh`
- `npm run e2e`
