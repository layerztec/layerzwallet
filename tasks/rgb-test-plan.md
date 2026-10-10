# RGB on-chain test plan (living document)

Purpose: the single place that says WHAT to test before any RGB release,
WHAT has already been run (and when, with which wallet), and HOW to run it
again without re-deriving the tooling. Update statuses after every run;
add new corner cases as they are discovered. Automation lives in
`tasks/rgb-e2e/` (bash lib codifying the manual steps — adb/idb/faucet).

Related: `tasks/ship-rgb.md` (launch checklist), `tasks/pr-draft-rgb-two.md`
(feature summary), `tasks/test-wallets-rgb.local.md` (gitignored seeds).

## Status legend

`PASS(date, wallet)` — run green on release build unless noted.
`—` — never run. `N/A` — not applicable.

## Version status (2026-10-09)

On rgb-sdk-rn 1.0.0-beta.37 / native rgb-lightning-node 0.16.0-beta.3:
- #61 (post-restore receive) — FIXED; 0.13-era VSS backup restores on 0.16.
- #58 (LN restore deadlock) — still reproduces, same signature, first try.
- #62 (two-device overwrite) — code unchanged in rgb-lib v0.3.0-beta.47-bfa
  (read-version-then-put, global_version: None); still unsafe.
- onchainSend endpoints patch rebased to beta.37 — upstream unchanged.
- SDK hard-disables Lightning on mainnet (assertLightningEnabled) — aligns
  with the on-chain-only launch.
- New in SDK: WebRGB provider + WalletConnect transport (bridge pairing
  path), BFA/burn, ethRpcUrl node param. Sandbox/demo carry a pairing
  example (docs/wallet-integration.md, utils/wallet/*).

## Core matrix

| ID | Case | Android | iOS |
|----|------|---------|-----|
| C1 | Fresh create/import → node up on rgb_testnet | PASS(2026-10-08, w15) | PASS(2026-10-08, w16) |
| C2 | Fund tBTC (faucet /sendbtc) → balance shows | PASS(2026-10-08, w15) | PASS(2026-10-08, w16) |
| C3 | createUtxos (colorable) | PASS(2026-10-08, w15) | PASS(2026-10-08, w16) |
| C4 | Receive from faucet (any-asset blind invoice) | PASS(2026-10-08, w15 ×2) | PASS(2026-10-08, w16) |
| C5 | Wallet→wallet send, full asset invoice | PASS(2026-10-08, w15→w16, 25 USDT) | receive side PASS |
| C6 | Wipe → import → VSS restore: tokens back, node up, 0 "Delaying monitor unlock" | PASS(2026-10-08, w15, 200 USDT) | PASS(2026-10-08, w16, 75 USDT) |
| C7 | Send AFTER restore | PASS(2026-10-08, w15; re-PASS w16 on the probe/retry build) | — (same shared code) |
| C8 | Tx history correct after each step | PASS (spot-checked) | PASS (spot-checked) |

## Corner cases (backlog, priority order)

| ID | Case | Status | Notes |
|----|------|--------|-------|
| X1 | Cross-platform restore: Android backup → iOS restore, and reverse | PASS(2026-10-08, w15 A→i 175 USDT; w16 i→A 75 USDT; deadlock=0 both) | Mobile↔mobile VSS payloads fully portable. Driven end-to-end by `rgb-e2e/lib.sh`. |
| X2 | Wipe mid-incoming-transfer (receiver wiped after faucet pays, before witness confirms) → restore picks up WaitingConfirmations | PASS(2026-10-08, w16: wiped with witness in mempool, restored, credited +100 after confirm; deadlock=0) | Pending blind allocation survives via VSS; credit lands once witness confirms. |
| X3 | Wipe right after send (sender wiped post-broadcast, pre-settle) | HAPPY PASS(2026-10-08, w16: send 25 → backup ok (auto-retries) → wipe → restore → 150, change intact, deadlock=0). HARD variant = finding below | Ran the HARD variant by accident: the post-broadcast VSS backup itself FAILED (server timeout), then wipe → restore from the STALE backup. Result: NO deadlock, NO double-spend (spent input reconciled away on refresh), but the send's CHANGE allocation (75 USDT) is permanently lost — it existed only in the un-backed-up local stash. Also a UX gap: the backup-failure error shows no txid and doesn't say funds WERE sent. The happy-path X3 (backup succeeds, then wipe) still worth a clean run. FOLLOW-UP: the in-flight 25 USDT never reached the receiver (20+ min; receiver invoice still pending) — if the orphaned witness/consignment never lands, the stale-backup scenario costs the FULL spent allocation (100), not just the change. Check wallet16 for the 25 next session. |
| X4 | Two devices, same seed, both alive → VSS single-writer fence behavior | PROVEN LOSSY(2026-10-09) | Both copies ran fine side by side (no fence errors surfaced — our vssClearFence "take own fence" masks the second device). Each copy received 5 USDT; their backups overwrote each other; after wipe+restore only the LAST writer's receive survived (60 of 65). A second restore does NOT recover it (so not X14) — the losing copy's blind-receive data existed only in the overwritten backup. PRODUCT: one seed = one device MUST be enforced or detected before mainnet; reported with code analysis: [rgb-sdk-rn#62](https://github.com/UTEXO-Protocol/rgb-sdk-rn/issues/62) (no client-persisted VSS version / global_version unused / rgb store unfenced / fence carries no owner metadata). 5 USDT burned as evidence. |
| X5 | Send ENTIRE token balance (no colored change) → re-receive after | PASS(2026-10-08, w16→w15 140 USDT, sender 0 / receiver 275; re-receive on w16 blocked by X14 then delivered after re-restore) | |
| X6 | Second asset (issue own) → multi-row tokens, per-asset send, restore of 2 assets | — | Issue screen exists. |
| X7 | Any-asset blind invoice on SEND side | FIXED+PASS(2026-10-08, commit 36465781; w16→w15 10 USDT via any-asset invoice, delivered, 135 on receiver) | Asset resolves from the tapped token, or auto-picks the wallet's only token; any-asset invoice with NO amount gets an explicit error (no on-chain token amount screen yet — our Receive and the faucet always embed amounts). |
| X8 | Stuck witness (fee too low) → failTransfers recovery | — | |
| X9 | Expired invoice: pay attempt UX + receiver's expired pending allocation cleanup | — | |
| X10 | Stale-backup restore: degraded no-VSS session mutated state, then restore from older backup | PROVEN LOSSY(2026-10-08, via X3-hard) | Restoring a backup that predates a send loses the send's change allocation (75 USDT gone live). No double-spend though. Mitigations before mainnet: (a) backup-failure UI must show txid + "funds sent, NOT backed up — do not reinstall"; (b) aggressive auto-retry of the critical backup; (c) consider blocking further RGB sends until re-backup succeeds. |
| X11 | App killed between broadcast and backup → pendingMutations re-backup on next start | PASS(2026-10-10, w16 Android + w17 iOS) | Live kill 32ms after rgb-lib "Send BTC completed" (in-device grep loop on the rgb-lib log → `am force-stop`; tBTC self-send 2000 sats). Relaunch: persisted ledger shows pendingMutations:1, home banner "Backup pending" appears (next SWR cycle, ≤30s). Banner tap → retryBackup → VSS v87, ledger 0. Bonus: rgb-lib own auto-backup (v86) fired ~2min after relaunch even without the tap — VSS data self-heals, our banner is the conservative UX layer on top. Control wipe+restore: gate+consistency pass (the spend is covered by v87 — the exact failure X15 shows when a spend confirms uncovered), 70 USDT + change intact, deadlock=0. Kill-timing recipe in runbook. |
| X12 | tBTC send-out while holding colored UTXOs (must not spend colored) | PASS(2026-10-08, w15 iOS: 3000 sats out, USDT row untouched) | |
| X13 | Restore with in-flight createUtxos tx unconfirmed | PASS(2026-10-10, w16 Android + w17 iOS) | createUtxos Num=20/Size=500 (upTo) → wipe 12s after "+20 UTXOs requested (broadcasting…)" → VSS restore: gate+consistency pass in ~2min WITH the tx still unconfirmed in mempool (tx `890e479e`, 14763 sats, 20 outputs). 70 USDT intact immediately; after the tx confirmed the restored wallet picked all 20 slots up by itself (UTXOs 17→34) and a fresh blind invoice generates fine; deadlock=0. Note: the consistency check tolerates an in-flight spend (unconfirmed ≠ "spent with another wallet") — contrast X15 where the same spend CONFIRMED without a covering backup bricks RGB. Run traps: createUtxos refuses when enough free slots exist ("Allocations already available"); home action buttons tap ~80px above the label (and_tap_home_action). |
| X15 | Vanilla tBTC spend missing from the VSS backup → restore REFUSES RGB entirely | FOUND(2026-10-10, w15) | rgb-lib consistency check: "Restored VSS backup is inconsistent: spent bitcoins with another wallet: [c7f4a5c3…:1]" — the X12 tBTC send whose post-send backup had failed on VSS timeouts. Stronger failure than X10: not change loss but a hard RGB refusal (our onboarding gate surfaces it with Retry/Skip — gate works as designed; Retry is futile, Skip leaves a BTC-only wallet). Confirms the post-broadcast backup retries (dfbc7ba9) and the pre-send probe are load-bearing for BTC sends too. wallet15 RGB written off (test funds). |
| X14 | CRITICAL: receive on a RESTORED Android node — blind invoices generated AFTER a VSS restore never pick their consignment up | FOUND(2026-10-08) | Closed-loop proof: fresh invoice on restored w16, sender posts fine (proxy `consignment.get` returns the blob for that exact RID), receiver's refresh polls NoConsignment forever ("Skipping transport endpoint" per rgb-lib online.rs:1177) — i.e. the restored node queries a DIFFERENT recipient id. Invoices from BEFORE the wipe restore and credit fine (X2); iOS-restored receivers worked. 3 transfers stuck this way (2 consignments still on the proxy). Re-restore probe CONFIRMS the wedge is in the restored node's on-disk/in-memory state, not the data: another wipe→VSS-restore picked BOTH parked consignments up within 2 minutes (+40 USDT). force-stop/relaunch does NOT help; only a fresh restore does, and invoices generated by the SECOND restored instance work normally (several deliveries since). So: data safe, UX broken on the first restored instance only. MUST fix upstream before mainnet; reported [rgb-sdk-rn#61](https://github.com/UTEXO-Protocol/rgb-sdk-rn/issues/61); FIXED in native 0.16.0-beta.3 (retested 2026-10-09 on beta.37: post-restore invoice credited, no second restore; 0.13 backup restores on 0.16 cleanly). |

## Known traps (cost us hours — read before running anything)

- faucet `/sendrgb` broadcasts ONLY on a later `/refreshtransfers` — loop
  until esplora sees the txid (confirmed expected behavior by UTEXO).
- Receiver-side consignment validation that fails on a network blip is NOT
  retried by periodic refresh on the same node instance; a node restart (or
  restore) revalidates fine. Report upstream if it recurs.
- Emulator DNS dies after host-Mac sleep → node hangs on `Getting BTC
  balance`, every later call times out on `rgb_testnet[0] lock`. Restart
  emulator with `-dns-server 8.8.8.8,1.1.1.1`. Keep the lid open during runs.
- Don't fire a second RGB op while one is in flight (UTXO-manager Refresh,
  then Fail Pending) — lock timeout. One op at a time.
- EAS local builds: Android and iOS strictly SEQUENTIALLY (parallel flakes
  the JS-bundle step), and don't drive the emulator during an Xcode build
  (CPU contention → system ANR storm).
- iOS release build sometimes SIGSEGVs in Rive on cold launch — relaunch.
- iOS sim randomly reverts to a RU hardware keyboard layout → seed typed as
  cyrillic + "Invalid mnemonic seed". `ios_import_seed` in lib.sh verifies
  the field and self-heals (PlistBuddy AppleKeyboards → en_GB QWERTY).
- beta.33 on npm == beta.32 byte-identical; native pins decide, not the JS
  version.
- AVD quick-boot snapshot REVERTED /data on every start (that is why wallets
  "vanished" after an emulator death) — FIXED 2026-10-10: config.ini now
  `fastboot.forceColdBoot=yes`, and `and_emu_start` launches with
  `-no-snapshot`. Verified: wallet16 survived a kill + cold restart (24s boot).
- Emulator died three times in one day, always while a gradle/Xcode build
  saturated the host. Root cause from the macOS crash report
  (`qemu-system-aarch64-2026-10-10-022628.ips`): SIGABRT via
  `std::__throw_bad_function_call` inside `grpc::CallbackWithSuccessTag::
  Proceed` — the emulator's netsim-WiFi gRPC link times out ("Netsim Wifi …
  gone due to ping timeout" precedes every death) and a dangling callback
  aborts the process. Emulator 37.1.11 bug, not resources. Fix: launch with
  `-feature -Wifi -feature -VirtioWifi` (`-Wifi` alone still initialised
  netsim; guest keeps ethernet). Also raised config.ini to
  hw.ramSize=4096, vm.heapSize=512M, hw.cpu.ncore=6, hw.gpu.enabled=yes
  (`ro.hardware.egl=emulation`) and launch with `-memory 4096 -cores 6`
  against the earlier ANR storms. Rule of thumb regardless: don't drive the
  emulator during a build. Caveat seen once: after a HARD qemu crash the
  guest /data came back without the app's data even on cold boot (dirty
  qcow2 overlay); a graceful `adb emu kill` + cold boot kept it. Keep
  `and_import_seed` handy.

## Runbook

Devices: iOS sim `597E4F02-2EE7-45D7-A185-266F99631F4B` (iPhone 17 Pro);
Android emulator `Pixel_API_29_AOSP` — AOSP image, so `adb root` works for
reading release-build LDK logs. LDK log path (both platforms):
`<app-data>/rgb/testnet/<fp>/.ldk/logs/logs.txt`; rgb-lib log: `<fp-dir>/log`.

Automation: `source tasks/rgb-e2e/lib.sh` — functions for wipe/install,
seed import, rgb_testnet switch (writes AsyncStorage directly), faucet
calls, balance waits, deadlock grep. Each function is the codified version
of the manual steps from the 2026-10 runs; see header comments there.

Faucet (direct HTTP, not the Telegram bot):
- fund BTC: `POST https://rln-signet.utexo.com/faucet/sendbtc
  {address, amount, fee_rate: 2, skip_sync: false}`
- send asset: `node /Users/limp/z/rgb-faucet/bin/faucet-http.js getasset
  '<rgb invoice>' [amountBaseUnits]`, then refreshtransfers-loop.

Deadlock check after any restore (the #58 signature, must be ABSENT for
on-chain):
`grep -c "Delaying monitor unlock" <ldk log>` → must be 0, and the node
must reach Home (balances render, no eternal "Verifying RGB backup…").

## Future: cheaper runs

- UTEXO regtest stack (`rgb-sdk-rn-sandbox` docs: `./regtest.sh start` —
  Bitcoin Core + electrum + RGB proxy, mine-on-demand) would remove the
  signet faucet dependency and the ~2-10 min confirm waits. Needs an env
  override for indexer/proxy endpoints in the app (today they come from SDK
  defaults per network). Worth wiring before the X-series soak tests.
- True CI e2e is blocked on the native RLN node (no pure-node runtime);
  device-attached runs via `tasks/rgb-e2e/` + a subagent driving them is
  the practical ceiling for now. A subagent run needs: this file, lib.sh,
  a built release artifact, and one seed per scenario (never reuse a
  wallet across concurrent runs — the LSP/faucet state is per-wallet).

## UI audit (2026-10-08, RC2 builds)

Send-confirm reworked and screenshot-verified on device: no overlapping
elements in any state. Probe spinner gates the button; probe-fail warning
is INLINE in the scroll flow after Send-to (user request); the send button
is opaque and docked; long invoices scroll fully clear of it; decode
errors render beside an icon without covering the field. States captured:
checking, ready-with-warning, sending, success, sent-backup-pending.
Screens still pending a pass: receive/invoice screens, UTXO manager,
onboarding (nothing reported there yet).

## Shipped mitigations (2026-10-08, commits dfbc7ba9 / 0b1cfb51)

Verified live on device (release build):
- Pre-send VSS probe gates Confirm ("Checking backup service…" spinner;
  disabled button); on failure/15s-timeout the button becomes "Send anyway
  (at your own risk)" behind a warning. Observed live: probe timed out
  against a slow VSS, warning path rendered, send still succeeded and the
  post-send backup passed on auto-retry.
- Post-broadcast critical backup retries 2s/8s/20s before surfacing;
  failure UI = "Sent — backup pending" with txid + don't-reinstall warning
  + Retry button. Home/send-confirm banner persists until a retry succeeds.

## Review-fixes builds (2026-10-10, commits 1826e858 / b56b4682 / b1b7bc0b)

Dual code review (codex + superpowers) applied: WC consent/lifecycle
(orphaned-prompt on hardware back, bootstrap gating to READY+auth, prompt
vs biometric lock, UNKNOWN-verification banner, Clear&Import wcService.reset)
+ backup-ledger races + banner pluralization. Builds carrying them:
- Android `lzw-wc3-android.apk` — smoke PASS (wallet16 restore: gate ~1min,
  70 USDT + 5265 sats, deadlock=0, WC sessions screen renders with projectId).
- iOS `lzw-wc3-ios.tar.gz` — smoke PASS (fresh wallet17 created: node init,
  rgb_testnet home, WC sessions screen renders; funded 30k sats).
  wallet15 retired (X15-bricked RGB).
Trap replay during the smoke: fresh-install cold start ANR-storm (app +
system) on the loaded emulator — dismiss Wait loop until it settles, then
onboarding proceeds fine.

## WC regression round (2026-10-10, commit c694bff6)

Live E2E regression pass of the review-fixes build (wc3) against the CLI dApp
driver. Flow videos: `~/Desktop/rgb-test-videos/wc *.mp4`.

- **FOUND+FIXED — consent sheet never surfaced.** wc3 pair → proposal reached
  the wallet, `confirm()` parked the prompt, but WcBootstrap never pushed the
  modal. First diagnosis (c694bff6) blamed `isAuthenticated` staying false
  with biometrics off and gated on `isBiometricEnabled && !isAuthenticated`
  instead — that made the prompt appear, but review round 2 (Codex +
  independent reviewer, both) found the REAL root cause: `<WcBootstrap/>` was
  mounted in `_layout.tsx` OUTSIDE `AuthStateContextProvider`, so it read the
  context defaults (`isAuthenticated:false, isBiometricEnabled:false` — the
  exact logcat values). The old gate was therefore always closed, and the
  c694bff6 gate was always OPEN — i.e. with biometrics ON the sheet would have
  been pushed over the lock screen. Fix (review round 2): mount WcBootstrap
  under AuthStateContextProvider and gate on `isAuthenticated`
  (`finalIsAuthenticated` = READY && past the lock, or immediately with
  biometrics off; false until settings load). Pure gate `shouldSurfacePrompt`
  + unit tests. Live on wc8/wc9 (Android): biometrics OFF → proposal prompt
  shows (5/5 runs). Biometrics ON, app relaunched into the BiometricLogin
  lock: a dApp `blindReceive` reached our backend (traced: `session_request
  rgb_blindReceive → blindReceive enter → confirm(Create RGB receive
  invoice?)`), the prompt parked behind the gate, NO sheet surfaced over the
  lock for 40s, the dApp's request stayed pending — invariant verified
  end-to-end. The "unlock → sheet appears" half could not be exercised on
  the emulator (device PIN/fingerprint removed on request → no in-process
  biometric unlock); it is covered by `shouldSurfacePrompt` unit tests and
  the biometrics-OFF path (same gate, `isAuthenticated` flips at init).
- **RESOLVED — "post-restart request stall" was an emulator artifact.** The
  stalls (run5/run6, lock runs 1-3) coincided with the emulator's netsim
  WiFi flapping ("Netsim Wifi … ping_timeout" in the emulator log — the
  same component that crashed the emulator). The guest's network dropped
  under host load, the relay WebSocket died silently, and fresh
  `session_request`s never reached WalletKit (traced: first queued request
  delivered, nothing after). With netsim WiFi disabled (`-feature -Wifi
  -feature -VirtioWifi`) every post-restart request flows — unlocked
  (stall-repro: enable → POLL_OK ×3) and locked (above). Not an app or SDK
  bug; no code change. Still upstream: the dApp-side stale `enabled` flag
  (webrgb-walletconnect#4).
- **PASS — session survives wallet restart.** Approve → force-stop →
  relaunch: WcBootstrap boots WalletKit (HAD_SESSIONS), session listed,
  wallet answers relay requests; Disconnect from the list → dApp receives
  `session_delete`. (Disconnect icon had no a11y label — fixed.)
- **RESOLVED (upstream, dApp-side SDK) — post-restart request handling.**
  Traced build (wc5) + raw-RPC probe settled it: the wallet side is correct.
  After a wallet restart the transport's per-process gate
  (`webrgb-walletconnect` wallet side, `record.enabled`) answers
  `rgb_getInfo` with NOT_ENABLED before reaching our backend — by design,
  consent is per process. The dApp-side provider in the SAME package keeps
  its own local `enabled` flag, never resets it on a wallet NOT_ENABLED, so
  `provider.enable()` short-circuits (no `rgb_enable` sent, "enabled"
  reported) and the dApp loops NOT_ENABLED forever. Proof: a raw
  `client.request(rgb_enable)` from the dApp made the wallet run
  `enable` → `getInfo` → POLL_OK (video `wc post-restart re-enable protocol
  - android.mp4`). The earlier "hang" was the transport's single serial
  `queue` waiting on `getProvider` → `lazyInitWallet` during RGB node cold
  boot on the overloaded emulator (slow boot = 76s), not a deadlock; fast
  boots (12s) never hung. Reported upstream (dApp-side fix: reset `enabled`
  on NOT_ENABLED / always send `rgb_enable` from `enable()`). No wallet
  change needed. The "Reconnect website?" branch in our provider is only
  reachable after `revoke()` (sessionApproved:true keeps the SDK provider
  enabled for the process) — kept, harmless.

## Final builds for this round (2026-10-10 evening)

`lzw-wc7-android.apk` / `lzw-wc7-ios.tar.gz` (scratchpad) carry everything up
to 9904507a: WC gate fix, Disconnect a11y label, banner pluralization, X9
auto-fail of expired invoices + honest UTXO-manager copy. Smoke PASS on both:
wallet16 (Android, re-imported after another emulator death — gate+consistency
clean on the post-X11 backup v94; 65 USDT) and wallet17 (iOS, 5 USDT) show
"Fail Expired Transfers" → "No expired transfers to fail." with live invoices
untouched, deadlock=0. Videos `utxo manager fail expired transfers - {android,ios}`.
Infra note: the AOSP emulator died twice during 500MB apk installs / gradle
runs today — `android-recover-smoke.sh`-style cold restart + re-import is the
fast path (≈6 min).

## Review round 2 (2026-10-10 evening, Codex + superpowers reviewer)

Range 1826e858..baba9185. Both reviewers converged on one real defect and a
few small ones; fixed minimal, no refactors:
- WcBootstrap mount point / gate (above) — the only Critical.
- Pre-send probe discarded a late success: after the 30s race flipped to
  "failed", a backup that completed at 35s left the warning up forever. Now a
  late success clears it.
- Auto-fail scope copy: rgb-lib's expired-only pass also fails sends the
  receiver never acknowledged (still unbroadcast → inputs return) — dialog +
  code comment say so.
- `sync()` skips the post-free backup once the wallet is disposed (no
  spurious ledger error for the next instance).
- a11y label fallback "Disconnect Unknown dApp".
Accepted as-is (minor, cosmetic): `_freedBySync` can under-report in the
button hint under a concurrent sync; 20ms sleep in one negative test.
X9 live proof on Android: a 60s WC invoice blinded a 3rd UTXO; after expiry a
plain Refresh (no button) returned the count to the 2 live ones (full list
of 35 scanned). Video `x9 expired invoice auto-freed on refresh - android`.

## Round 1-5 results (2026-10-10, videos in ~/Desktop/rgb-test-videos)

- **(1) WC regression on review-fixes build — FOUND+FIXED** (gate bug, see
  "WC regression round"); restart persistence PASS; post-restart re-enable
  traced to upstream dApp-side SDK (webrgb-walletconnect#4).
- **(2) WC on iOS — PASS (first ever).** wc6 (gate fix) on wallet17: paste
  (idb chunked typing; buttons shift when the TextArea grows — read coords
  after typing) → prompt in 3s → approve → enable/getInfo/listAssets →
  blindReceive consent → USDT-pinned invoice → ledger-first backup
  (pendingMutations 0) → disconnect. Video `wc pairing and blind receive -
  ios.mov`.
- **(3) X11 asset variant — PASS both sides.** Android wallet16 pays
  wallet17's 5 USDT blind invoice; force-stop 1.24s after rgb-lib "Send
  completed" (post-broadcast backup was mid-upload: "Starting VSS backup…"
  logged, no "completed"). Relaunch: ledger pendingMutations:1, banner
  "Backup pending / 1 change is syncing" (shows ~4 min after a cold
  relaunch — the SWR fetcher waits on `lazyInitWallet` of the RGB node),
  tap → VSS v94, ledger 0, balance 65 USDT. Receiver (iOS wallet17) credited
  **5 USDT ~7 min after the crashed send** — consignment delivery survived
  the sender crash. Videos `rgb usdt send with crash recovery - android.mp4`,
  `… - backup retry - android.mp4`, `rgb receive usdt - ios.mov`. Note:
  rgb-lib's own auto-backups (v91-93) ran between relaunch and the tap; our
  ledger stays conservative until a ledger-tracked backup lands.
- **(4) iOS kill/wipe windows.** X11-iOS PASS (wallet17, wc7): tBTC
  self-send 2000 sats, `simctl terminate` 162ms after rgb-lib "Send BTC
  completed" with "Starting VSS backup…" already logged (post-broadcast
  backup killed mid-flight). Relaunch: AsyncStorage-manifest ledger
  `pendingMutations:1`, banner "Backup pending" within 15s. Bonus coverage:
  the first banner retry FAILED (VSS PUT timed out — the iOS sim's network
  stalls on large uploads while small GETs work; VSS answered the host in
  67ms) → ledger `lastBackupError{kind:network}`, banner "Backup failed, 1
  change not yet saved…", "Backup retry failed" alert; a later retry landed
  (v12, 10.7s) → ledger 0, banner gone. Also observed: the 15s pre-send probe
  flipped to "Send anyway (at your own risk)" while the probe backup was
  still uploading (took 21s, succeeded) → probe budget raised to 30s +
  "slow or unreachable" copy (098335fe). a11y note: the banner's label is
  prefixed with the icon glyph — match by substring, not prefix.
  X13-iOS PASS: createUtxos Num=9 → `simctl uninstall` the same second
  "+9 UTXOs requested (broadcasting…)" appeared → reinstall → import →
  gate+consistency in 26s with the tx unconfirmed → 5 USDT intact, UTXOs
  7→12 (restored node already sees the in-flight outputs), deadlock=0.
  Videos `x11 kill between broadcast and backup - ios.mov`, `x11 backup
  retry from banner - ios.mov`, `x13 wipe with pending createutxos and
  restore - ios.mov`. iOS-specific a11y traps for the e2e lib: the address
  input is a Pressable ("To, Enter address") until focused; the amount input
  is one grouped element ("0.00, — USD, Balance …, max") — tap the group.

- **(5) X9 — expired invoices did NOT free their UTXOs — FOUND+FIXED.**
  wallet16 had 8 "blinded" UTXOs, ≥4 from invoices expired a day earlier
  (same outpoints blinded at 01:xx). rgb-lib never fails an expired unpaid
  invoice on its own; the wallet only called `failTransfers` from the manual
  UTXO-manager button, whose copy also wrongly claimed it aborts live
  invoices. docs.rs settles the semantics: without a recipient/txid,
  `fail_transfers` fails **expired** WaitingCounterparty transfers only.
  Live check: "Fail all" → 8 → 2 blinded (the 2 = today's live invoices,
  untouched). Fix: `sync()` now runs the expired-only fail pass after every
  `refreshWallet` (skipSync, backup only when a slot was freed); the button
  is now "Fail Expired Transfers" with honest copy. Unit-tested (3 cases).
  Videos `utxo manager expired invoice slots - android.mp4`, `utxo manager
  fail pending transfers frees slots - android.mp4`.

## WebRGB / WalletConnect (feature, 2026-10-09, commit f20583d0)

Wallet-side pairing shipped (v1: read set + blindReceive, rgb:utexo only).
Verified on device (release build):
- [x] Build with WC deps + compat shim: no regressions — wallet16 VSS
      restore green on the WC build (65 USDT, deadlock=0), RGB smoke ok.
- [x] Connected dApps screen renders; unconfigured state shows the
      projectId instruction (screenshot wc-unconfigured.png).
- [x] FULL E2E PASS (2026-10-09, projectId live): CLI dApp driver
      (tasks/rgb-e2e/wc-dapp.mjs, runs from mobile/ via its node_modules)
      → wc: URI → paste+Connect in app → session approve sheet →
      enable/getInfo/listAssets served promptlessly → blindReceive with
      consent sheet → invoice delivered to the dApp → faucet paid →
      +5 USDT credited (70 on wallet16). App restart: session restored in
      the list AND a request on it was routed and answered (protocol-
      correct NOT_ENABLED until the dApp re-calls enable()). Disconnect
      from the session list works. Screenshots: wc-session-prompt /
      wc-invoice-prompt / wc-restored-session.
      Note: getInfo advertises exactly our v1 set; listAssets returns the
      asset id under `id` (driver gotcha, not a bug).
- [ ] Phase 2 backlog: sendAsset consent flow, burnAsset/getConsignment
      (needs ethRpcUrl + BurnOperations port), injected provider in our
      DAppBrowser, mainnet (post soft-launch), wc: deep-link scheme.
