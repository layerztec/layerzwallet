# RGB migration: rgb-sdk-rn beta.39 (RLN) → beta.41 (`RgbLibRn`, L1 only)

Status: IN PROGRESS on branch `rgb-l1` (2026-11-18). UTEXO answered (below).
Decisions (user, 2026-11-18):
- nothing shipped with RGB → no backup compatibility needed; Lightning dropped;
- migrate NOW without cloud backup (phase 3 option C as the interim state:
  ledger kept as scaffolding, "no cloud backup" banner, manual file
  export/import in Tools);
- mainnet USDT IS in scope → mainnet enablement is GATED on cloud recovery
  (option A if UTEXO ships VSS on RgbLibRn, else option B — our own). The
  migration itself lands on testnet first; the mainnet switch is the last
  step and does not flip until restore-by-seed is proven (X2/X11/X13/X15);
- ext migrates in the same effort (rgb-sdk-web beta.13, `RgbLibWeb`).

## UTEXO answers (chat, 2026-11-18)
- LN may come back, not anytime soon (RLN production readiness: Q1).
- File backup only for now; VSS on L1 "soon" → option A stays the target
  for mainnet recovery, option C is the interim.
- Use the SDK through `UTEXOWallet` (more shared functionality will land
  there; eases Web↔RN).
- Release: RGB USDT on-chain on bitcoin mainnet + a Mint UI (mint by locking
  USDT on any chain). Public-signet Mint UI link promised, not available yet
  → proceed without it; WebRGB burn/mint surface stays out of v1.

## Target stack

| package | now | target |
|---|---|---|
| `@utexo/rgb-sdk-rn` | beta.39 (UTEXOWallet + RLN 0.17) | beta.41 (`RgbLibRn` engine, native rgb-lib bfa.6) |
| `@utexo/rgb-sdk` | — | beta.10 (`UTEXOWallet({engine})` facade, `/webrgb` provider) |
| `@utexo/rgb-sdk-core` | beta.9 | beta.10 (`SharedWalletApi` v1) |
| `@utexo/webrgb` / `-walletconnect` | 0.1.3 / 0.1.3 | 0.1.6 / 0.1.5 |
| WalletConnect / WalletKit | 2.25 / 1.6.0 | unchanged (walletkit pins 2.25) |

## What the new engine gives / takes away

Same names, mostly same shapes (keep): `getAddress`, `getBtcBalance`,
`listUnspents`, `createUtxos`, `sendBtc`, `blindReceive`, `witnessReceive`,
`failTransfers`, `syncWallet`, `refreshWallet`, `refreshTransfers`,
`listAssets`, `listTransfers`, `listTransactions`, `issueAssetNia`,
`decodeRGBInvoice`, `estimateFeeRate`, `isDisposed`, `dispose`.

Changed:
- construct: `new RgbLibRn({network:'utexo', storageDirPath, …}, mnemonic)` →
  `init()` (no params) → auto-connect / `goOnline()`. No `createWallet`, no
  RLN password, no signer, no unlock params, no LSP.
- send: `onchainSend(...)` single call (no `sendBegin/sendEnd`); `skipSync`
  refused. Native parses the invoice itself and uses its transport endpoints
  → our `PATCH(layerz)` endpoints patch should become unnecessary (verify on
  iOS, then delete `patches/@utexo+rgb-sdk-rn+*.patch`).
- errors: `WalletBackendError` with codes (`KEYS_UNAVAILABLE`,
  `WALLET_STORAGE_IN_USE`, `INSUFFICIENT_FUNDS`, …) — remap our classifiers.
- identity: `getNodeInfo()` gone; `getWalletIdentity()` = `{id, network,
  protocol}` (no pubkey). WalletConnect `account` needs a new stable public
  id (derive from the colored account xpub / master fingerprint ourselves).
- WebRGB provider moved to `@utexo/rgb-sdk/webrgb`; `WebRgbProvider` now
  REQUIRES `burn.operations` in options even if burn isn't offered — check
  whether a no-op store is acceptable or we must gate the method list.

Gone:
- Lightning entirely (channels, LN invoices, LSP, lightning address).
- VSS: `vssBackup`, `vssBackupInfo`, `restoreFromVss`, fence, auto-backup.
  Only `exportBackup({password}) → bytes`, `exportBackupToFile`, and module
  fn `restoreBackupFromFile({filePath,password,dataDir})` (dataDir must be
  new/empty). Facade README: VSS on RgbLibRn = **no**, on RgbLibWeb = yes.
  Core still ships `deriveVssSigningKeyFromMnemonic`,
  `buildVssConfigFromMnemonic`, `DEFAULT_VSS_SERVER_URL`.

Build requirements:
- TurboModule-only (New Architecture) — RN 0.86 / Expo 57: already on.
- iOS deployment target 16.0 (set via expo-build-properties).
- Android ABIs: only `arm64-v8a`, `x86_64` (we currently also build
  `armeabi-v7a`, `x86`) → `reactNativeArchitectures` in gradle.properties via
  config plugin. Check breez/spark natives are fine with that (they are
  per-ABI .so; dropping ABIs is safe).
- iOS xcframeworks are NOT in the tarball: SDK `postinstall` downloads them
  (macOS, https + sha256). EAS local sandbox runs npm install → needs
  network; add a loud check like `ensure-breez-artifacts.js`.
- Android: Maven `com.utexo:rgb-lib-bfa-android` — check repo is reachable
  from the EAS gradle config (may need a `maven {}` entry).

## Phases

### 0. Branch + spike (½ day)
- [ ] branch `rgb-l1` off `rgb-two`.
- [ ] bump deps, add `@utexo/rgb-sdk`, drop the beta.39 patch (keep file
      until iOS send is verified).
- [ ] app.json: iOS 16, ABI filter; build both platforms with an EMPTY
      adapter stub → proves native linking before touching logic.
- [ ] 20-line smoke on device: construct → init → getAddress → blindReceive
      → faucet → refresh → balance. Confirms network `utexo` endpoints
      (indexer / proxy defaults) match our signet faucet setup.

### 1. Delete Lightning (mechanical, ~−2.5k lines)
- [ ] screens: `rgb-open-channel`, `send-rgb-ln`, `rgb-lightning-address`,
      `pay-rgb-external`, `request-rgb-external`, `pay-rgb-address`;
      `receive-rgb-ln` (mixed → keep only what on-chain needs, likely delete).
- [ ] routes in `ProtectedRouteStack`, "Channel" home action, Receive/Send
      sheet rows ("over Lightning", "My Lightning address", "external
      invoice") for RGB networks.
- [ ] `rgb-wallet.ts:536-715` LN methods; `shared/types/rgb-adapter.ts` LN
      types; `mobile/src/modules/rgb-adapter.ts` LSP/signer/unlock code
      (129-260, 345-506); `rgb-lsp-errors.ts`; `getRgbUseLspStorageKey`.
- [ ] LN unit tests; LN rows in the test plan → archived section.

### 2. New adapter + wallet core
- [ ] `rgb-adapter.ts`: build `RgbLibRn` + `UTEXOWallet({engine})`; storage
      dir per network/account; mnemonic via reader fn (SecureStore), not a
      long-lived string.
- [ ] `IRgbWallet`/`IRgbAdapter`: shrink to the L1 surface; `send` →
      `onchainSend`; drop `shimVssMethods` proxy.
- [ ] `rgb-wallet.ts`: init path without VSS probe/gate; error mapping to
      `WalletBackendError` codes; keep `sync()` + expired-transfer auto-fail
      (same `failTransfers` shape); keep slot logic (`createUtxos`,
      blind→witness fallback).
- [ ] unit tests: rewrite the adapter mock; keep on-chain cases.

### 3. Backup / recovery  ← depends on UTEXO answer + decision below
Common to every option: the ledger (`pendingMutations`, banner, critical
post-broadcast backup, pre-send probe) is transport-agnostic and stays; only
the `vssBackup()` call site changes.
- A. UTEXO ships VSS on RgbLibRn → re-point ledger at `backupToVss()` /
     `restoreFromVss()`, keep onboarding gate. Smallest diff.
- B. Our own cloud backup on `exportBackup()` bytes: encrypt-by-seed is
     already done by the SDK password (derive password from mnemonic), upload
     blob + monotonically increasing version to (b1) UTEXO VSS server via
     core's `buildVssConfigFromMnemonic` if the protocol is usable from JS,
     or (b2) our backend / user's iCloud-Drive. Restore = download →
     `restoreBackupFromFile` into an empty dir → consistency check on first
     sync. Needs single-writer rule (X4/#62) designed by us.
- C. No cloud backup for the soft launch: banner "No cloud backup — export a
     backup file" + manual export/import in Tools. Testnet-only acceptable;
     not for mainnet funds.

### 4. WalletConnect / WebRGB
- [ ] imports → `@utexo/rgb-sdk/webrgb`; webrgb 0.1.6 types
      (`burnDestination`, optional `getReceivedMint` — not offered in v1).
- [ ] WC account id from our own derivation; `resolveAccount()` no longer
      needs the node online → bootstrap gets simpler.
- [ ] `burn.operations` requirement — resolve (no-op store or method gate).
- [ ] webrgb-walletconnect 0.1.5 "resume" semantics: re-check our
      restart path (dApp re-enable now handled upstream).
- [ ] ledger-first `notePendingMutation` around `blindReceive` stays.

### 5. UI cleanup
- [ ] onboarding "Verifying RGB backup…" gate → per option A/B/C.
- [ ] `send-confirm` probe + "Sent — backup pending" → per option.
- [ ] `RgbBackupBanner`, `useRgbBackupStatus` → per option.
- [ ] UTXO manager unchanged; Tools: add export/import backup file (C, or
      as a power-user fallback in A/B).

### 6. Verification
- [ ] tsc, unit suites (mobile + ext).
- [ ] device matrix re-run on the new engine: C1–C8 core flows, X2 (wipe →
      restore), X9 (expired slots), X11/X13 (kill/wipe windows) for the
      chosen backup option, WC E2E both platforms, cross-platform restore.
      Videos to ~/Desktop/rgb-test-videos.
- [ ] dual review (codex + superpowers) before merge.

### 7. Ext (same effort, after mobile phase 2)
- [ ] `rgb-sdk-web` beta.9 → beta.13 (`RgbLibWeb` on rgb-lib-wasm 1.0.0-beta.4),
      `rgb-sdk-core` beta.3 → beta.10, add `@utexo/rgb-sdk` facade.
- [ ] ext adapter on the same shrunken `IRgbWallet`; drop ext LN UI
      (ReceiveLightning/SendLightning RGB branches) and LN adapter code.
- [ ] RgbLibWeb HAS the VSS extension → wire ledger to `backupToVss()` /
      `restoreFromVss()` there first: it is the cheapest place to learn the
      new VSS API and proves option A's shape before RN gets it.
- [ ] ext tsc + units + Playwright smoke; manual restore check in Chrome.

### 8. Mainnet (last, gated)
- [ ] cloud recovery live on RN (A or B) and re-tested.
- [ ] NETWORK_RGB endpoints (indexer/proxy/evm) confirmed with UTEXO.
- [ ] "one seed = one device" rule decided (X4/#62 equivalent on L1).
- [ ] only then expose NETWORK_RGB in the switcher.

## Open questions
- Upstream (#74): RLN future; VSS on L1; facade vs engine; release plan.
- Ours: see the questions asked in chat on 2026-11-18 (backup option, ext
  timing, mainnet in scope?).

## Risks
- No VSS on RN = no restore-by-seed. Biggest product risk; drives phase 3.
- `WALLET_STORAGE_IN_USE` directory lock + our lazy-init cache: make sure
  dispose/re-import paths release the engine (Clear & Import, account switch).
- iOS bindings download at install time (network in EAS sandbox).
- beta churn: two breaking releases in two weeks; pin exact versions.

## Progress log
- 2026-11-18 phase 0 (code): deps bumped (rgb-sdk-rn beta.41, rgb-sdk beta.10,
  core beta.10, webrgb 0.1.6, webrgb-walletconnect 0.1.5 now a direct dep),
  beta.39 patch removed, `rgb-adapter.ts` rewritten on `RgbLibRn` +
  `UTEXOWallet` (801 → ~250 lines), Android `buildArchs` arm64-v8a/x86_64.
  iOS bindings downloaded by the SDK postinstall. tsc + units green.
  Native build + device smoke: PENDING.
- 2026-11-18 phase 1: Lightning removed (−2756 lines): 7 screens, LSP
  constants/errors, action-sheet rows, Channel button, use-LSP toggle, LN
  methods/types, LN tests. mobile 584 units, ext 537 units, tsc both green.
- Phase 4 (partly): WC provider on `@utexo/rgb-sdk/webrgb`; account id =
  sha256(colored account xpub) exposed by the adapter as `getAccountId()`
  (engine identity id is per-install); provider gets a no-op burn journal and
  `getInfo().methods` is filtered to the v1 list. Device E2E: PENDING.
- Interim backup state needs no new UI: the adapter throws `VssUnavailable`,
  which the ledger already classifies as `unavailable` → banner "No cloud
  backup yet", critical paths don't throw.
- 2026-11-18 evening — DEVICE RESULTS (new engine, builds `lzw-l1-ios.tar.gz`
  137MB / `lzw-l1-android.apk` 305MB; were ~190MB / ~500MB with RLN):
  - iOS (wallet17) + Android (wallet16): import → RGB testnet opens, BTC
    balance + October tx history show (same on-chain keys as the RLN wallet;
    RGB assets from the RLN era are gone, as expected — no restore path).
  - iOS: blind invoice, issue asset (NIA, 100000 units) PASS.
  - iOS → Android 500 units PASS; Android → iOS 200 units PASS; balances
    reconcile (iOS 99700, Android 300). Videos in ~/Desktop/rgb-test-videos
    (`l1 ios — …`, `l1 android — …`).
  - beta.39 endpoints patch NOT needed: native parses the invoice endpoints.
  - ext: Playwright smoke `rgb-smoke.spec.ts` — RgbLibWeb opens + syncs.
- FOUND: UTEXO retired the RLN-era hosts — `esplora-api.utexo.com`,
  `rln-signet.utexo.com` (faucet), `vss-server.utexo.com` are NXDOMAIN on
  8.8.8.8 / 1.1.1.1 / 9.9.9.9. Consequences:
  - the beta.39 build on `rgb-two` is dead (no indexer, no VSS) → this
    migration is mandatory, not optional;
  - new `utexo` endpoints (engine defaults): esplora
    `dev.esplora-01.mint.utexo.com`, proxy `dev.rgb-proxy.utexo.com`; mainnet
    `electrs-01.utexo.com:50002`, `rgb-proxy.utexo.com`;
  - NO faucet → tests use a self-issued asset; USDT needs the Mint UI;
  - web engine's default VSS url is the dead host → ext runs with VSS OFF
    (`RGB_VSS_URL = null` in ext adapter) until UTEXO gives a new server.
    Ext therefore has NO recovery path at all right now (no file export UI).
- UX fixes from the run: banner no longer claims the seed alone restores the
  wallet; send-confirm shows a plain "export a new backup file" note instead
  of "backup service unreachable / send at your own risk"; single-option
  Send sheet removed.
- e2e trap: `idb ui text` drops characters on a 239-char invoice unless typed
  in ≤8-char chunks with ~1.2s gaps (and chunks need `--`, some start with
  `-`). Android `input text '<invoice>'` is exact.
- Two proxy bugs found on device and fixed (`shared/modules/rgb-facade-proxy.ts`
  + unit test on the real `UTEXOWallet`): facade getters need `this` = the
  wallet (#private engine), and its read-only extension properties must be
  returned untouched. Symptoms were WebRGB `getInfo` → INTERNAL_ERROR and
  "RGB backup export failed".
- Review (independent subagent) → fixed: backup key now bound to the network,
  awaited `move()`/`copy()` (async in expo-file-system 57), old state dropped
  only after the restored wallet opens; dead Node-SDK integration test removed.
- WalletConnect on Android (pre-fix build): pairing + session approve PASS
  with the new account id; `getInfo` failed on the proxy bug → re-test.

## Open items
- [x] iOS: backup file export + import on device — PASS (build
      `lzw-l1d-ios`): export 39KB file → wipe app → seed-only import shows NO
      tokens → Import RGB Backup File (Files picker) → relaunch → 99700 LZ and
      the 3 transfers are back. Video `l1 ios — wipe, seed only…`.
- [ ] Android: same export/import run; send FROM the restored iOS wallet.
- [ ] X-matrix on the new engine: X9 (expired slots), kill/relaunch
      mid-send, wipe → import file → balances.
- [ ] WalletConnect E2E on the new engine (new account id → re-pair).
- [ ] ext: file export/import UI (only recovery path while VSS is off).
- [ ] ask UTEXO: new VSS server URL (web engine default is dead), a faucet
      or Mint UI link for test USDT, whether `dev.*` hosts are the intended
      public signet.
- [ ] mainnet stays gated (phase 8).
