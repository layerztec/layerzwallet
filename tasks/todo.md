# Mac Build Enablement

- [x] Enable Mac Catalyst support in the iOS native project and Podfile.
- [x] Add local commands for Mac Catalyst builds.
- [x] Add an EAS custom build profile for Mac Catalyst artifacts.
- [x] Document local and EAS usage.
- [x] Validate the native configuration and build path.
- [x] Patch ExpoCamera for Mac Catalyst and confirm the app launches locally.

## Review

- `EXPO_ENABLE_MAC_CATALYST=1 pod install` completes successfully after excluding the Breez Liquid native module from Mac Catalyst autolinking.
- A clean local `npm run mac` now finishes with `EXIT:0` and emits a launchable app bundle at `mobile/ios/build/Build/Products/Debug-maccatalyst/LayerzWallet.app`.
- The built bundle now contains `Contents/MacOS/LayerzWallet`, and `open mobile/ios/build/Build/Products/Debug-maccatalyst/LayerzWallet.app` starts the app process successfully.
- Spark and Breez are stubbed out for Mac Catalyst so the app can boot without those unsupported native SDKs.
- ExpoCamera is patched so Catalyst builds compile without Vision/DataScanner APIs, and the QR scanner flow now exits with an explicit unsupported message on Mac Catalyst.