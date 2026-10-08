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

## Core matrix

| ID | Case | Android | iOS |
|----|------|---------|-----|
| C1 | Fresh create/import → node up on rgb_testnet | PASS(2026-10-08, w15) | PASS(2026-10-08, w16) |
| C2 | Fund tBTC (faucet /sendbtc) → balance shows | PASS(2026-10-08, w15) | PASS(2026-10-08, w16) |
| C3 | createUtxos (colorable) | PASS(2026-10-08, w15) | PASS(2026-10-08, w16) |
| C4 | Receive from faucet (any-asset blind invoice) | PASS(2026-10-08, w15 ×2) | PASS(2026-10-08, w16) |
| C5 | Wallet→wallet send, full asset invoice | PASS(2026-10-08, w15→w16, 25 USDT) | receive side PASS |
| C6 | Wipe → import → VSS restore: tokens back, node up, 0 "Delaying monitor unlock" | PASS(2026-10-08, w15, 200 USDT) | PASS(2026-10-08, w16, 75 USDT) |
| C7 | Send AFTER restore | PASS(2026-10-08, w15) | — |
| C8 | Tx history correct after each step | PASS (spot-checked) | PASS (spot-checked) |

## Corner cases (backlog, priority order)

| ID | Case | Status | Notes |
|----|------|--------|-------|
| X1 | Cross-platform restore: Android backup → iOS restore, and reverse | PASS(2026-10-08, w15 A→i 175 USDT; w16 i→A 75 USDT; deadlock=0 both) | Mobile↔mobile VSS payloads fully portable. Driven end-to-end by `rgb-e2e/lib.sh`. |
| X2 | Wipe mid-incoming-transfer (receiver wiped after faucet pays, before witness confirms) → restore picks up WaitingConfirmations | PASS(2026-10-08, w16: wiped with witness in mempool, restored, credited +100 after confirm; deadlock=0) | Pending blind allocation survives via VSS; credit lands once witness confirms. |
| X3 | Wipe right after send (sender wiped post-broadcast, pre-settle) | PARTIAL(2026-10-08, w15) — see finding | Ran the HARD variant by accident: the post-broadcast VSS backup itself FAILED (server timeout), then wipe → restore from the STALE backup. Result: NO deadlock, NO double-spend (spent input reconciled away on refresh), but the send's CHANGE allocation (75 USDT) is permanently lost — it existed only in the un-backed-up local stash. Also a UX gap: the backup-failure error shows no txid and doesn't say funds WERE sent. The happy-path X3 (backup succeeds, then wipe) still worth a clean run. |
| X4 | Two devices, same seed, both alive → VSS single-writer fence behavior | — | Our vssClearFence "always take own fence" model breaks here. Minimum: document unsupported; better: detect. |
| X5 | Send ENTIRE token balance (no colored change) → re-receive after | — | |
| X6 | Second asset (issue own) → multi-row tokens, per-asset send, restore of 2 assets | — | Issue screen exists. |
| X7 | Any-asset blind invoice on SEND side | GAP | Our send UI routes it to the BTC path (send-address.tsx decode → no matched token). Receiving works. Fix: let user pick token when decode has no assetId. Decide before launch — bridge/Unisat may issue such invoices. |
| X8 | Stuck witness (fee too low) → failTransfers recovery | — | |
| X9 | Expired invoice: pay attempt UX + receiver's expired pending allocation cleanup | — | |
| X10 | Stale-backup restore: degraded no-VSS session mutated state, then restore from older backup | PROVEN LOSSY(2026-10-08, via X3-hard) | Restoring a backup that predates a send loses the send's change allocation (75 USDT gone live). No double-spend though. Mitigations before mainnet: (a) backup-failure UI must show txid + "funds sent, NOT backed up — do not reinstall"; (b) aggressive auto-retry of the critical backup; (c) consider blocking further RGB sends until re-backup succeeds. |
| X11 | App killed between broadcast and backup → pendingMutations re-backup on next start | — | Unit-covered ledger logic; not exercised live. |
| X12 | tBTC send-out while holding colored UTXOs (must not spend colored) | unit only | Live-run from the May arc predates RLN rewrite. |
| X13 | Restore with in-flight createUtxos tx unconfirmed | — | |

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
- AVD `default_boot` snapshot: killing the emulator process resets /data —
  wallets die; `adb reboot` (guest reboot) keeps data. Reimport by seed.

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
