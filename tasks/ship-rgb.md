# Ship RGB

Branch: `rgb-two`. Both RGB networks are flagged `isTestnet: true` so they
hide behind the "Show Testnets" toggle until upstream blockers clear.
This doc is for picking the work back up later.

## Current state (2026-06-19) — beta.17 + USDT-over-LN

Pins (mobile): `@utexo/rgb-sdk-rn@1.0.0-beta.17` + `@utexo/rgb-sdk-core@1.0.0-beta.4`.
ext stays on `@utexo/rgb-sdk-web@1.0.0-beta.9` — UTEXO still hasn't shipped a
web build with the LSP / RLN surface, so the LN scope is mobile-only.

Three of the four beta.10 blockers below are resolved by beta.11+:

- **bitcoind RPC** — beta.14 added `resolveUnlockParams(network, params)`
  which accepts an indexer URL instead. Mobile adapter uses
  `getNetworkDefaults('signet')` → indexer + proxy fall in from the SDK; no
  bitcoind creds needed on the device.
- **VSS gone** — beta.14 reintroduced `vssUrl` as a wallet-construction
  param; the SDK runs VSS internally. Mobile adapter shims the old
  `vssBackup*` methods on the returned wallet as no-ops so the shared
  `IRgbAdapter` shape still satisfies ext (beta.9, real VSS) and mobile
  (beta.14+, SDK-managed VSS) at once.
- **`IRgbAdapter` ~50% incompatible** — covered by the shim above plus the
  new constructor wiring (`UTEXOWalletNodeParams` + `PasswordRLNSigner`,
  password derived deterministically from mnemonic, init/unlock guarded
  by a `.rgb-rln-initialized` sentinel file).

The "ext cannot follow" blocker is still real and unchanged. LN UI is
gated to `rgb_testnet` so it never appears on ext.

### LN integration (Phase A→B→C)

- **A. Scaffold** — `IRgbWallet` got `Partial<IRgbLnReceive>` with three
  asset-aware methods: `lightningReceiveAsset`, `lightningSendAsset`,
  `awaitLightningReceiveSettlement`. Mobile adapter delegates each to a
  cached `UtexoLsp` (one-per-wallet via WeakMap).
- **B. UI receive** — `mobile/app/receive-rgb-ln.tsx`. Tab view shows
  BOLT11 + RGB invoice with QR + copy. Settlement row polls the LSP for
  90s and renders waiting/settled/timed-out/error states.
- **B. UI send** — `mobile/app/send-rgb-ln.tsx`. Paste/scan an `rgb:`
  invoice → `lsp.sendAsset` → payment hash + status echo.
- **Action sheets** — both Send and Receive on `rgb_testnet` open a
  sheet with the LN option; mainnet sees only the on-chain paths.
- **Constants** — `mobile/src/constants/rgb-lsp.ts`:
  `signet → 'https://lsp-signet.utexo.com'` and USDT asset id
  `rgb:YKIEjkhU-iqVFK0y-bfDUio6-bukqH7o-dxjctKB-5TuQ7aM` (both lifted from
  `UTEXO-Protocol/rgb-sdk-rn-demo`). Mainnet entries are still `null`
  pending UTEXO publishing prod endpoints — the receive screen surfaces a
  visible warning when either is null.

### Still pending live verification

- iOS sim live test of the LN receive flow.
- Android live test (compile passes, sim run not done).
- Real LSP roundtrip: confirm `lsp.connect()` reaches the signet LSP and
  `waitForChannel(USDT)` actually opens a JIT inbound channel.

### Patches

None needed for `@utexo/rgb-sdk-rn`. beta.17 fixed `Rgb.mm`
`bitcoindRpcPort` nullability natively so the beta.14 patch was dropped.
`mobile/patches/` only carries the breez podspec widening + the stacks
wallet-sdk patch — neither is RGB.

## beta.10 assessment — superseded (kept for history, 2026-05-22)

UTEXO closed rgb-sdk-rn #21, #22, #25, #26, #27, #28, #29, #30 claiming fixes
in `@utexo/rgb-sdk-rn@1.0.0-beta.10`. The fixes are real — verified against
beta.10 source (table below). But **beta.10 is a ground-up product
replacement, not a version bump.** Did not bump / build / migrate this session.

### What beta.10 actually is

- beta.9 (current) = lightweight rgb-lib wallet: electrum + RGB proxy, VSS
  cloud backup. `new UTEXOWallet(mnemonic, { network })`.
- beta.10 = on-device **RGB Lightning Node (RLN)** — a full LDK node running
  on the device. New API:
  `new UTEXOWallet({ storageDirPath, daemonListeningPort, ldkPeerListeningPort,
  network, xpubVan, xpubCol, masterFingerprint }, signer)` + lifecycle
  `init() / unlock(params) / shutdown() / destroy() / reinit()`. Adds Lightning
  channels, peers, keysend.

### Four hard blockers

1. **ext cannot follow.** `@utexo/rgb-sdk-web` has no beta.10 — npm `latest` is
   beta.9; only an unstable `1.0.6-test` tag exists. The shared `rgb-wallet.ts`
   / `IRgbAdapter` abstraction cannot target the beta.10 RLN model (mobile) and
   the beta.9 rgb-lib model (ext) at the same time. "Mobile + ext" scope is
   unachievable as a single migration.
2. **bitcoind RPC required, none available.** `unlock()` needs
   `bitcoindRpc{Username,Password,Host,Port}` — non-optional in
   `IRLNUnlockParams`. No default is exported (only `DEFAULT_INDEXER_URLS` /
   `DEFAULT_TRANSPORT_ENDPOINTS`). The faucet (`node-api.thunderstack.org`) is
   a hosted RLN node, not a public bitcoind RPC. Without bitcoind creds the
   on-device node can't start → beta.10 cannot be tested at all.
3. **VSS backup removed.** `restoreFromVss`, `restoreFromBackup`, and
   `WalletManager` all throw `"not supported in the RLN-only build"`. The
   entire backup safety net below (`STORAGE_KEY_RGB_INITIALIZED`, VSS health
   probe, backup ledger, onboarding gate, `RgbBackupBanner`) is invalidated.
   beta.10 offers only local-file `rlnBackup(path, password)`.
4. **`IRgbAdapter` contract ~50% incompatible.** beta.10 `UTEXOWallet` stubs
   `sendBegin / sendEnd / createUtxosBegin / createUtxosEnd / signPsbt` (all
   throw) and has no `vssBackup*` methods at all. Half of `rgb-wallet.ts`
   (`init()` probe, `acquireFreshWalletAfterProbe`, `tryBackup`) has no
   beta.10 equivalent.

### Per-issue verification (beta.10 source)

| Issue | UTEXO claim | Verified |
|-------|-------------|----------|
| #30 x86_64 `libbdk-rn.so` | bdk-rn dropped | ✅ `bdk-rn` gone from deps; `signPsbt` is a throwing stub — no eager dlopen on import. |
| #28 `Assignment` shape iOS≠Android | `Vec<String>` + `parseAssignment` | ✅ `RlnTransfer.assignments: string[]`; `parseAssignment()` regex-parses `Fungible(n)` uniformly on both platforms. |
| #22 `listUnspents` `{type:"type"}` | same `parseAssignment` | ✅ `RlnRgbAllocation.assignment: string` → `parseAssignment`. |
| #26 `sendBegin` empty PSBT | PSBT flow removed | ✅ `sendBegin`/`sendEnd` throw "not implemented"; new atomic `send()` → `rlnSendRgb`, native throws on failure. |
| #25 `sendBegin` needs `assetId` | invoice fallback | ✅ `send()`: `assetId = params.assetId ?? decoded.assetId`, throw only if neither. |
| #21 `blindReceive` crash on omitted amount | optional amount | ✅ `blindReceive` → `rlnRgbInvoice(assetId??null, amount??null, …)`; no hardcoded `{type:'Fungible', amount}`. |
| #29 `expiration` vs `expirationTimestamp` | fixed at node level | ◑ Transfers use `expiration`, invoices use `expirationTimestamp` — each consistent within its type. Accept. |
| #27 `failTransfers` stuck pending | "by design" | ✖ Not a code fix. Recovery path = pass a specific `batchTransferIdx`. |

### Recommendation

Stay on beta.9. The 8 issues are genuine but only reachable by adopting the RLN
model — a multi-day rewrite that also (a) is impossible for ext until
`rgb-sdk-web` ships an RLN build, (b) needs a reachable testnet bitcoind RPC,
and (c) deletes the VSS backup design. This is a product decision (run a
Lightning node on-device?), not a dependency chore. Open questions for UTEXO
are in `/tmp/kkk.txt`. The beta.9 patch
(`mobile/patches/@utexo+rgb-sdk-rn+1.0.0-beta.9.patch`, issue #24) is
version-pinned and would not carry to beta.10.

### If the team decides to adopt RLN later

Migration shape (mobile only — ext blocked until `rgb-sdk-web` RLN build):

- Rewrite `mobile/src/modules/rgb-adapter.ts` around `UTEXOWallet` +
  `NativeExternalRLNSigner`; derive `xpubVan/xpubCol/masterFingerprint` via the
  exported `generateKeys`/`deriveKeysFromMnemonic`.
- Source bitcoind RPC creds + ports as config (UTEXO-hosted or self-hosted).
- Redefine `IRgbAdapter`/`IRgbWallet` to the beta.10 surface; drop the
  `sendBegin/sendEnd` and `vss*` members.
- Replace the VSS backup safety net in `rgb-wallet.ts` with a new design over
  `rlnBackup` (local encrypted file) + your own cloud sync, or wait for UTEXO
  to restore VSS in the RLN build.
- Keep ext on beta.9 behind a capability flag until `rgb-sdk-web` catches up.

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

## Future TODO: ext context for RGB

Today RGB runs in the **popup window context** (`ext/src/modules/rgb-adapter.ts`
imported only from `Popup.tsx`; `background-message-controller.ts:90-91`
explicitly throws if RGB is hit from the SW). When the user closes the popup,
the JS context dies — any long-running RGB op (transfer broadcast, large sync,
VSS roundtrip) is aborted mid-flight.

Won't fix `rgb-sdk-web#7` (the wasm panic is in rgb-lib's Rust, host-independent;
same bytecode panics in popup / SW / offscreen). But once #7 lands, we should
move RGB to an **offscreen document** (Chrome MV3 offscreen API) — survives
popup close, full DOM/IDB access, no MV3 service worker idle-kill. Service
worker by itself isn't the right target (30s idle eviction in MV3 makes it
worse than popup for state retention).

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
