# Ship RGB

Branch: `rgb-two`. Both RGB networks are flagged `isTestnet: true` so they
hide behind the "Show Testnets" toggle until upstream blockers clear.
This doc is for picking the work back up later.

## What works

- **Android, RGB Testnet**: issue NIA asset, generate blind invoices,
  receive tokens, send tokens, send/receive tBTC, UTXO Manager (Issue /
  Fail Pending / Refresh), backup banner state machine, restore-from-seed
  VSS gate.
- **iOS sim, RGB Testnet**: same surface as Android *except* outbound
  RGB token sends fail (see `psbtBase64` blocker below). tBTC send/receive
  works. RGB receive works.
- **Cross-platform RGB token transfer**: only `Android → iOS` validated
  end-to-end (Phase C-1 in the run log).
- **Onboarding gate** (`mobile/app/onboarding/verifying-rgb-backup.tsx`,
  `ext/src/pages/Popup/OnboardingVerifyingRgbBackup.tsx`): import path
  probes VSS, surfaces typed errors, offers Skip; create path bypasses.
- **Backup banner** (`mobile/components/RgbBackupBanner.tsx` + ext
  mirror): persistent on `pending` / `failed`, retry on tap. Hidden on
  `synced`. Hook: `shared/hooks/useRgbBackupStatus.ts`.

## What's broken (upstream)

| ID | Surface | Issue |
|----|---------|-------|
| [rgb-sdk-web#6](https://github.com/UTEXO-Protocol/rgb-sdk-web/issues/6) | ext | Mobile-encrypted VSS payload undecodable on web — cross-platform restore broken. |
| [rgb-sdk-web#7](https://github.com/UTEXO-Protocol/rgb-sdk-web/issues/7) | ext | `rgb-lib-wasm` panics on fresh wallet's first `listAssets`. Blocks all ext RGB ops. |
| psbtBase64-empty | iOS sender | rgb-lib's `sendBegin` returns `""` instead of throwing → `sendEnd` fails with `psbtBase64 must be a non-empty string`. Repro + analysis in run log below. **Not yet filed.** |
| `failTransfers` ghost-pending | iOS / Android | UTXO Manager shows `pending` allocation, `failTransfers` reports "no pending transfers to fail". After a failed send, `listAssets` drops the asset until app restart. **Not yet filed.** |
| bdk-rn x86_64 | EAS Maestro | `bdk-rn` (transitive of `@utexo/rgb-sdk-rn`) only ships `arm64-v8a`; eager dlopen on app boot kills app on x86_64 emulators. Issue draft in `/tmp/kkk.txt`. **Not yet filed.** |

## Upstream issues already filed

- [rgb-sdk-rn#20](https://github.com/UTEXO-Protocol/rgb-sdk-rn/issues/20) — iOS ignores `dataDir`, hardcodes `Documents/<network>/` (referenced in `mobile/src/modules/rgb-adapter.ts:nativeWalletDirs`).
- [rgb-sdk-rn#22](https://github.com/UTEXO-Protocol/rgb-sdk-rn/issues/22) — `listUnspents` assignment display bug `{type:"type",amount:null}` (referenced in `mobile/app/utxo-manager.tsx:235`).
- [rgb-sdk-rn#24](https://github.com/UTEXO-Protocol/rgb-sdk-rn/issues/24) — Android TMPDIR (patched in `mobile/patches/@utexo+rgb-sdk-rn+1.0.0-beta.9.patch`).
- [rgb-sdk-rn#25](https://github.com/UTEXO-Protocol/rgb-sdk-rn/issues/25) — `sendBegin` requires `assetId` even when invoice carries it. Worked around in `transferToken` (`shared/class/wallets/rgb-wallet.ts:462-475`).
- [rgb-sdk-rn#28](https://github.com/UTEXO-Protocol/rgb-sdk-rn/issues/28) — `Assignment` shape mismatch iOS vs Android (`{Fungible: 100}` vs `{type, amount}`); only `listUnspents` is normalized in JS shim, `listTransfers` isn't. Comment + worked around at `shared/class/wallets/rgb-wallet.ts:annotatedTransfersToCommon`.
- [rgb-sdk-rn#29](https://github.com/UTEXO-Protocol/rgb-sdk-rn/issues/29) — `Transfer.expiration` (TS) vs `expirationTimestamp` (native) field rename. Not consumed in our code yet.

## Critical files

- `shared/class/wallets/rgb-wallet.ts` — `init()` probe, `acquireFreshWalletAfterProbe`, `tryBackup`, `transferToken`, `getCommonTransactions`, `RgbBackupServerUnreachableError` / `RgbBackupLostError`.
- `shared/types/IStorage.ts` — `getRgbBackupStateStorageKey`, `getRgbInitializedStorageKey`.
- `shared/types/rgb-adapter.ts` — `IRgbAdapter` interface.
- `shared/hooks/useRgbBackupStatus.ts` — banner data source.
- `mobile/src/modules/rgb-adapter.ts` — RN-side adapter, per-mnemonic data dir, corrupt-store recovery.
- `mobile/app/send/{send-address,send-confirm}.tsx` — RGB invoice auto-decode, amount routing.
- `mobile/app/utxo-manager.tsx`, `mobile/app/issue-asset.tsx`, `mobile/app/receive-rgb-token.tsx` — debug screens.
- `ext/src/pages/Popup/{SendRgb,ReceiveRgbToken,OnboardingVerifyingRgbBackup}.tsx`, `ext/src/pages/Popup/components/RgbBackupBanner.tsx`.

## Tests

- `shared/tests/unit-vi/rgb-wallet.test.ts` — 57/57 passing. Covers all four
  init() probe outcomes, both `tryBackup` modes, `transferToken` invoice
  variants, `getCommonTransactions` token-row attribution incl.
  `requestedAssignment` preference for Send.
- `shared/tests/integration-vi/rgb-wallet.test.ts` — integration suite.
- `mobile/.maestro/{home,restore}.yml` — fail on x86_64 emulators (EAS test
  farm) due to bdk-rn dlopen crash. Pass locally on arm64-v8a emulators.

## Backup design (one-page summary)

VSS is the only durable record. The hard failure mode is silent-overwrite:
fresh install + valid mnemonic + transient VSS outage → SDK creates fresh
wallet → next mutation `vssBackup`s empty state → real backup gone.

Three pieces guard against this:

1. **`STORAGE_KEY_RGB_INITIALIZED_<network>`** flag, set after first
   successful init. Distinguishes "first ever creation on this device"
   (fresh OK) vs "wallet was here before and now backup says missing"
   (red flag → throw `RgbBackupLostError`).
2. **VSS health probe** (`vssBackupInfo`) before falling back to fresh
   creation. Throws `RgbBackupServerUnreachableError` if probe itself
   fails.
3. **Backup ledger** (`{pendingMutations, lastBackupAt, lastBackupError}`),
   persisted, surfaced via `useRgbBackupStatus` → banner.

Onboarding gate calls `lazyInitWallet(NETWORK_RGB_TESTNET)` to surface
the typed errors during restore (not on first RGB tap). Skip is allowed;
subsequent inits still fail with the same typed error so the safety net
isn't bypassed.

## Verification quick-resume

Test seed (mobile only — has TEST asset issued):
`setup fashion rice grant earn rabbit rude claw knife robust knife actor`

- iOS sim: `38489619-1224-48CD-A378-10F23D30B1F9` (iPhone 17, iOS 26.3).
  Show Testnets toggle is unreliable via UI taps — easier to edit
  AsyncStorage `manifest.json` directly: set
  `STORAGE_KEY_SETTINGS.showTestnets="ON"` and
  `STORAGE_SELECTED_NETWORK="rgb_testnet"`, then relaunch.
- Android emu: `emulator-5554` (Galaxy S24 Ultra, API 34, arm64).
- Faucet: `bash ~/z/rgb-faucet.sh <address> [amount_sats]` (default 16900).

To resume:
1. Reload mobile app, switch to RGB Testnet, confirm balance/tokens render.
2. Generate Receive invoice on Android, send 100 base units of TEST from
   iOS. Expected today: fails with `psbtBase64 must be a non-empty string`.
   File the upstream issue + repro.
3. ext: blocked on rgb-sdk-web #6, #7. No additional verification possible
   until those land.

## Quick "is RGB still broken?" smoke

```bash
# unit + integration
cd mobile && npx vitest run shared/tests/unit-vi/rgb-wallet.test.ts
cd mobile && npx vitest run shared/tests/integration-vi/rgb-wallet.test.ts

# Maestro (arm64-v8a emulator only — see bdk-rn x86_64 row above)
cd mobile && maestro test .maestro/home.yml
```
