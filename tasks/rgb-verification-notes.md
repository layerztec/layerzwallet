# RGB end-to-end verification — running notes

Live notes from the verification run; updated as tests progress. Issues
that block a specific test get skipped (per user direction) and recorded
here so we can revisit.

## Environment snapshot

- Test seed (mobile): `setup fashion rice grant earn rabbit rude claw knife robust knife actor`
- Faucet: `bash ~/z/rgb-faucet.sh <address> [amount_sats]` (default 16900)
- ext popup URL: `chrome-extension://jfkjdddajnobopldmhfpgblcidgohkak/popup.html`
- iOS sim: `38489619-1224-48CD-A378-10F23D30B1F9` (iPhone 17, iOS 26.3)
- Android emu: `emulator-5554` (Galaxy S24 Ultra, API 34)

## Skipped / blocked tests (revisit later)

### B-EXT-1 — chrome-devtools MCP server died after `chrome.runtime.reload()`
- After clearing `chrome.storage.local` + IndexedDB + reloading runtime in
  the popup, the chrome-devtools MCP server disconnected and all
  `mcp__chrome-devtools__*` tools became unavailable.
- No chrome process was running on the host; MCP wasn't able to respawn.
- Fix on next run: avoid `chrome.runtime.reload()` from inside the
  evaluate_script call; close the popup tab via MCP first, then reload via
  a new page request. Or kill any leftover chrome-for-testing process and
  let MCP spawn fresh.
- All ext-side tests (A1–A5, C1–C4, D1–D3, E*, F1) are skipped this run
  until MCP is restored.

### A-IOS-1 — iOS launched with a fresh wallet (lost test seed)
- The iOS sim was on a "Wallet created successfully" TOS celebration when
  the run started — meaning storage was cleared between sessions. No DEMO
  token, no funds.
- Workaround: wipe + import the test mnemonic on iOS (in progress).

## Test pass/fail log

### Phase A — Per-platform smoke

- **A7 — Android RGB Testnet home renders, banner hidden when synced** ✅
  Already on `selectedNetwork-rgb_testnet`, balance 0.0000446 tBTC,
  Receive/Send/Issue/UTXOs buttons present, no `RgbBackupBanner` element
  in tree (synced state). Recent Sent/Received tx history shows transfers
  from prior testing.

- **A6-android — Receive RGB Asset flow** ✅
  Receive button → bottom sheet ("Receive sats" / "Receive RGB asset") →
  Receive RGB Asset screen renders (Asset selector "Any asset", base
  units amount input, Generate Invoice). Generate Invoice → RGB Invoice
  screen with QR + invoice string + Private (blind) badge + 33m expiry.
  Sample invoice (any-asset, 1 base unit) generated:
  ```
  rgb:~/~/ae/sb:utxob:fbZFwePS-oOFBS4I-nSyznC4-B_u1T0Z-kSksZEW-cGPB81A-MoqJo?assignment_name=assetOwner&expiry=1777853205&endpoints=rpcs://rgb-proxy-utexo.utexo.com/json-rpc
  ```
  Note: this Android wallet has **no RGB tokens** (only 0.0000446 tBTC).
  No Tokens section visible on Home — confirmed no DEMO etc.

- **A5-android — Send screen mounts on RGB Testnet** ✅
  Send button → Send tBTC address screen renders. Header is "Send tBTC"
  (per-network ticker, not per-prefix as on ext). Pasting an `rgb:`
  invoice and pressing Next routed to the account-based amount entry
  screen (`send-amount-acc`) — `validateAddress` accepted the invoice,
  the decode lookup didn't auto-fill amount because invoice was issued
  with "Any asset" (no `assetId`), so it fell through to amount entry
  per `send-address.tsx:75-91`. Header staying "Send tBTC" on RGB
  Testnet is intentional on mobile — different from ext, where the
  header flips by prefix. Not a bug.

- **B-android-issue — RGB Issue Asset path works end-to-end** ✅
  Issue button → Issue RGB Asset screen renders (Ticker, Name,
  Precision=8, Amount=1000). Filled TEST / Test Token / 8 / 1000 →
  "Issue Asset" → Asset Issued screen with asset id
  `rgb:WmHHJS~4-Z0PHv8s-0Prxx1N-Cg9tS_Y-JEQvsJb-S0vqqZ4`. Done →
  Home now shows Tokens section: "Test Token 0.00001 TEST" (1000
  base units / 10^8 = 0.00001).
  Side effect: bootstraps an RGB token on Android for cross-platform
  Phase C tests when ext/iOS are restored.

### Phase E — Backup banner state machine (passive observation)

- **E1-android — RGB Issue triggers VSS backup, banner does not appear** ✅
  After Issue Asset succeeded, Home rendered with no `RgbBackupBanner`
  visible. `useRgbBackupStatus` only mounts the banner when state is
  `pending` or `failed`; the issue→backup window was below render
  granularity. adb logcat showed no RGB/VSS errors. Implies VSS backup
  flushed cleanly before the next state read. E2/E3 (forced failure)
  not exercised — would need to interfere with VSS reachability mid-op.

### iOS state at end of run

- iOS sim launched with a fresh wallet (lost test seed). On the Bitcoin
  network. Show Testnets is OFF in Tools, so RGB Testnet doesn't appear
  in the BackdoorNetworkSwitcher list yet (only `rgb` mainnet shows).
- Toggling Show Testnets ON via UI taps was unreliable in this session
  (taps at the listed (49, 113) coords didn't register a state change in
  the visible button color). Easier next-time path: deep-link to
  `layerzwallet://Tools` and tap the precise listed `SettingOption-showTestnets-ON`
  coordinates, OR write directly to AsyncStorage (settings key
  `showTestnets` = `'ON'`). Deep-linking via `xcrun simctl openurl
  <udid> layerzwallet://BackdoorNetworkSwitcher` works to navigate.
- iOS Settings → Recovery Phrase tapped through to a glitched dark screen
  (only the gear icon visible) — couldn't read the seed. Possibly an
  animation race with the dev client.

### Phase A — what's still pending

- **A1, A2, A3, A4-ext, A5-ext** — all blocked on chrome-devtools-mcp
  recovery. ext popup needs the MCP server back to drive the onboarding
  flow + RGB screens.
- **A6-ios, A8-ios** — pending iOS reaching RGB Testnet (need showTestnets
  toggle to take + test seed re-imported, OR fresh-fund and skip DEMO).

## Continuing next run

Pick-up checklist:
1. Restart `chrome-devtools-mcp` (parent process / claude code restart).
2. On iOS: deep-link to Tools, toggle showTestnets ON, then deep-link
   to BackdoorNetworkSwitcher → select rgb_testnet. Fund via faucet.
3. Resume ext by: load popup → wipe storage via evaluate_script
   (DON'T call `chrome.runtime.reload()` from inside that script — close
   the popup tab from MCP first), then onboard fresh and run A1/A2.
4. Cross-platform RGB transfer using `TEST` asset on Android as the
   source: generate Receive invoice on ext or iOS for the TEST asset id,
   send from Android via Send screen.

## Resumed run (chrome-devtools restored)

### Phase A on ext

- **A1-ext — Import path triggers VSS gate** ✅
  Onboarding-intro → Import wallet → paste test seed
  (`setup fashion rice grant earn rabbit rude claw knife robust knife actor`)
  → Set password (`qweqweqwe`) → URL transitioned to
  `/onboarding-verifying-rgb-backup`. Gate showed "Backup not verified"
  with "Could not verify your RGB backup" + Retry/Skip. Console error:
  `Failed to initialize wallet for rgb_testnet account 0: Invalid backup data`
  — the same cross-platform VSS interop bug from `rgb-sdk-web/issues/6`
  manifesting at the gate as designed (gate caught the throw,
  surfaced it, offered Skip — exactly the intended UX).

- **A2-ext — Create path skips gate** ✅
  Wiped `chrome.storage.local` + IndexedDB + sessionStorage via
  `evaluate_script` (no `chrome.runtime.reload()` this time → MCP
  stayed up). Reloaded popup → Onboarding-intro → Create wallet
  (fresh seed: `what mesh mention price strategy capable multiply
  still defense believe name gallery`) → Set password → URL went
  straight to `/onboarding-tos`, **bypassing** the gate. `rgb.justImported`
  flag was never set, so OnboardingCreatePassword's branch correctly
  routed past the gate.

- **A3-ext — RGB home renders, banner hidden when synced** ✅
  Switched to `Rgb` network on home (note: ext shows mainnet RGB in
  the network bar, not testnet — the gate uses `NETWORK_RGB_TESTNET`
  internally for the probe). 0 BTC balance, no `RgbBackupBanner`
  element in tree.

- **A4-ext — Receive RGB Asset screen** ✅
  Receive button → `/receive-rgb-token` mounts. Asset combobox
  ("Any asset"), amount spinbutton, Generate Invoice + "Receive sats
  instead". Invoice generation **fails** at runtime (see B-EXT-2 below).

- **A5-ext — Send RGB screen + prefix-based header flip** ✅
  Navigated to `/send-rgb`. Header initially "Send tBTC". Pasting
  `rgb:WmHHJS~4-...` (Android-issued asset id) → header flips to
  "Send RGB asset". Continue button enables. Implementation correctly
  watches the input prefix.

### Confirmed bugs (skipped tests; need upstream fixes)

### B-EXT-2 — rgb-lib-wasm panics on fresh-wallet first call (filed as issue #7)

Upstream tracking: https://github.com/UTEXO-Protocol/rgb-sdk-web/issues/7

- After Create-wallet path (no prior VSS backup), navigating to
  `/receive-rgb-token` on Rgb mainnet, filling amount=1, clicking
  Generate Invoice produces:
  ```
  [rgb-lib WASM panic] at lib.rs:391
  Uncaught RuntimeError: unreachable
  [rgb-lib WASM panic] at lib.rs:529
  [rgb-lib WASM panic] at lib.rs:213
  failed to load asset list: RuntimeError: unreachable
  ```
- These are different from the cross-platform interop bug (which
  throws "Invalid backup data" without a panic). This is a **fresh
  wallet** path that the web SDK can't traverse.
- The panic happens at the asset-list-load step that's invoked
  before invoice generation. The 52/52 unit tests for
  `acquireFreshWalletAfterProbe` pass because they mock the SDK; the
  real `@utexo/rgb-lib-wasm` panics on what should be a no-op fresh
  state.
- **Suggested fix in our codebase**: catch the panic upstream of the
  `requestReceive` UI handler and show a clearer error than "Failed
  to generate invoice"; or upstream-fix `rgb-lib-wasm` to handle the
  empty-asset-list path without unreachable.
- **Next**: file as second issue in `/tmp/kkk.txt` for the user.

### B-EXT-3 — cross-platform VSS payload undecodable on web (existing)
- Already filed as `rgb-sdk-web#6`. Confirmed again on this run: the
  test seed has a mobile-encrypted VSS backup; web SDK throws
  `Invalid backup data` on `vssBackupInfo()`. The gate handles this
  gracefully (Skip path bypasses).

### What still works on ext after the bugs

- Wallet creation & import flows ✅
- Password / TOS / unlock flows ✅
- Onboarding gate state machine (Import → gate, Create → bypass) ✅
- RGB Receive/Send screen mounts and prefix detection ✅

### What can't be verified from ext until WASM panic is fixed

- Phase C cross-platform RGB transfer (ext leg). Both invoice
  generation and asset list load fail.
- Phase D (tBTC send via SendRgb). Address validation + Continue
  works but the broadcast path likely also hits the WASM panic.
- Phase E live banner mutation (need a successful issue/transfer
  to capture the pending→synced transition on ext).
- Phase F1 (web-side restore via Import) blocked by both bugs.

### Status by task

- #58 Phase A — DONE (A1✅ A2✅ A3✅ A4✅ A5✅ A6-android✅ A7✅,
  A6-ios/A8 deferred; ext A4/A5 mount-only).
- #59 Phase B funding — DONE on Android (already had 0.0000446 tBTC,
  TEST token issued).
- #60 Phase C cross-platform — BLOCKED (ext fresh-wallet WASM panic
  + iOS state). Skipped this run.
- #61 Phase D tBTC — BLOCKED on ext (same panic). Could still run
  iOS↔Android tBTC if iOS is recovered.
- #62 Phase E banner — Android backup-after-issue passed without
  banner (synced before render). E2 forced-failure not exercised.
- #63 Phase F VSS interop — CONFIRMED BROKEN as expected for
  mobile→web (issue #6). Web-side fresh restore blocked by panic.

## Files modified for new issue draft

(See `/tmp/kkk.txt` follow-up — to draft after this verification run.)

## Resumed run 2 — iOS via AsyncStorage patch + cross-platform RGB

Workaround for the iOS UI tap reliability problem: terminated the
iOS app, edited `RCTAsyncLocalStorage_V1/manifest.json` directly to
set `STORAGE_KEY_SETTINGS` `showTestnets:"ON"` and
`STORAGE_SELECTED_NETWORK:"rgb_testnet"`, then relaunched. iOS came
up on Rgb_testnet with the existing seed's prior funds:
`0.00008135 tBTC`, with tBTC tx history present.

### Phase A on iOS

- **A6-ios — Receive RGB Asset screen renders + invoice generation works** ✅
  Receive button → "What to receive" sheet → "Receive RGB asset" →
  Receive RGB Asset screen (Asset "Any asset", Amount field, Generate
  Invoice). Filled amount=1, Generate → RGB Invoice screen with QR +
  Private (blind) badge + 33m expiry. Invoice copied via "Tap to copy":
  ```
  rgb:~/~/ae/sb:utxob:49dDNX35-_TNeftE-QvA15SZ-j_2Ptr~-PUPlUSw-zrDt~4A-OUlK3?assignment_name=assetOwner&expiry=1777889377&endpoints=rpcs://rgb-proxy-utexo.utexo.com/json-rpc
  ```
  iOS tBTC receive address (`tb1pal0nx4wlj8690qa4rh4pp2qd83dj2ys9nl276a0gynw26s6vnm24qj5nvec`)
  observed via Receive sats path.

### Phase C — Android → iOS RGB transfer (broadcast leg) ✅

- Android: home → Send → pasted iOS invoice → tapped Test Token row
  to select asset → Next.
- Send TEST screen rendered (header flipped from "Send tBTC" to
  "Send TEST"), balance shown 0.00001 TEST. Tapped max → 0.00001
  filled → Next.
- Confirm screen: Total 0.00001 TEST, Network Fee 0 tBTC, Send to:
  the iOS rgb invoice. Tap Confirm Send.
- **"Sent successfully!" card** — full broadcast succeeded.
- Android home post-send: Test Token balance dropped from 0.00001 TEST
  (1000 base units) to **0.00000999 TEST** (999 base units), confirming
  exactly 1 base unit was sent (the invoice's specified amount).
- **Sender side fully validated** end-to-end: address → token select →
  amount → confirm → broadcast → balance decrement.

### Phase C — iOS receive leg ✅

- Re-opened Receive RGB Asset on iOS to re-engage polling. **Asset
  selector now shows "Any asset" + "TEST"** — wallet auto-discovered
  the new asset.
- Backed to Home → Tokens section shows **Test Token: 0.00000001 TEST**
  (exactly the 1 base unit Android broadcast).
- **Phase C-1 (Android → iOS) end-to-end SUCCESS**: invoice gen on iOS,
  broadcast on Android, receive sync on iOS, balances reconcile across
  both platforms.
- The "success card" on iOS Receive was missed because we navigated
  away during sync; not a bug, just a UX detail that the card only
  appears if the user stays on Receive while the asset arrives.

### Status update

- **#60 Phase C** Android↔iOS RGB transfer (1 of 5 transitions): ✅
  Other 4 transitions (ext legs blocked by lib bug #7; iOS↔Android
  reverse direction blocked by bug B-IOS-1 below).
- **#62 Phase E** banner: extended observation — issue+broadcast on
  Android still produced no visible banner; backups must be flushing
  cleanly within the render-cycle. E2 forced-failure not exercised.

### Phase D — tBTC vanilla send ✅

- **D2 — iOS → Android tBTC** ✅
  Android Receive sats → captured tBTC address
  `tb1pmvr9la9geer8v9gm9dv7k3ld4qysckzx5n5c9cxyk3hrutwguqkqzhafxn`.
  iOS Send → pasted address → Next → amount 0.00001 → Next → Confirm
  Send → "Sent successfully!" card. Android home polled within
  ~5 seconds: balance went from `0.0000446 tBTC` →
  **`0.0000546 tBTC`** (+0.00001, exact match).
  Validates the mobile bitcoin send path on RGB-testnet (which uses
  the underlying signet-mapped Bitcoin chain) end-to-end.

### B-IOS-1 — iOS Send rejects Android-generated invoice with assetId

- Tried iOS → Android reverse RGB transfer.
- Generated invoice on Android for **TEST asset specifically**
  (asset id embedded in URL path before `/ae/sb`):
  ```
  rgb:WmHHJS~4-Z0PHv8s-0Prxx1N-Cg9tS_Y-JEQvsJb-S0vqqZ4/RWhwUfTMpuP2Zfx1~j4nswCANGeJrYOqDcKelaMV4zU/ae/sb:utxob:_0ojK8vN-MtLVgVa-6V9XsnV-bchvbdm-nY1tNOr-tT9lNFQ-T4uIq?assignment_name=assetOwner&expiry=1777889893&endpoints=rpcs://rgb-proxy-utexo.utexo.com/json-rpc
  ```
- iOS Send: pasted invoice → Send tBTC screen showed Tokens row with
  "Test Token 0.00000001 TEST" → tapped Next.
- Confirm screen rendered correctly: Total `0.00000001 TEST`,
  Network Fee `0 tBTC`, full Send-to invoice. Auto-decoded the asset
  and amount from the invoice URL **for display**.
- Confirm Send → **Error**: `asset_id is required for send operation`,
  toast `Failed to broadcast transaction: ValidationE...`.
- Suggests the mobile send-confirm path decodes the invoice's asset
  segment for the UI but doesn't pass it through to the rgb-lib
  `pay`/`transferToken` call. Likely fix lives in
  `mobile/app/send/send-confirm.tsx` — when invoice contains
  `assetId`, propagate it into the `transferToken` args instead of
  letting the lib infer from the empty `asset_id` field.
- Skipped: rather than fix in this verification run, recording for
  follow-up. **One direction (Android→iOS) of cross-platform RGB
  is the validated success.**

