# RGB: bump to rgb-sdk-rn beta.23 + USDT-over-Lightning on signet

Branch: `rgb-two`. ~100 commits ahead of `origin/master`. Local only —
do not push without product sign-off.

## What changed

- **Mobile RGB SDK bump**: `@utexo/rgb-sdk-rn` beta.9 → **beta.23** (and
  `@utexo/rgb-sdk-core` beta.3 → beta.4). Every beta.10 blocker
  (`tasks/ship-rgb.md` "beta.10 assessment") resolved by beta.11+; the
  cross-platform `IRgbAdapter` shape holds against a beta.10 extension
  and a beta.23 mobile at the same time. beta.21–23 pulled RLN native
  bindings v0.7→v0.9 (unlock-failure recovery, LSP apaya fix, remote
  external signer, VSS retry) — JS surface unchanged.
- **Mobile adapter rewrite** (`mobile/src/modules/rgb-adapter.ts`): new
  RLN-backed `UTEXOWallet` constructor (`UTEXOWalletNodeParams` +
  `PasswordRLNSigner`), `resolveUnlockParams` for indexer defaults,
  Proxy that shims the old `vssBackup*` methods to no-ops so the shared
  `IRgbAdapter` shape still spans mobile (SDK-managed VSS) and ext
  (real VSS on beta.9). RLN lifecycle robustness — dedupe wallet
  construction per (mnemonic, network) with a `Map<string, Promise>`,
  destroy the node on init/unlock failure, swallow benign init errors
  when keys already exist on disk. Per-mnemonic port offset
  (`sha256[0..3] % 997`) so two simulators on the same host don't
  collide on the LDK/daemon ports.
- **Patches**: dropped the beta.9 and beta.14 `Rgb.mm` `_Nullable`
  patches — upstream fixed both natively. `mobile/patches/` now
  carries zero rgb-sdk-rn entries.

### Lightning integration (USDT, signet only)

- `IRgbWallet` got `Partial<IRgbLnReceive>` — four asset-aware methods:
  `lightningReceiveAsset`, `lightningSendAsset`, `payLightningInvoice`,
  `awaitLightningReceiveSettlement`. Mobile delegates each to a cached
  `UtexoLsp` (one-per-wallet `WeakMap`, with rejected-promise eviction
  so a transient network blip doesn't permanently poison the cache).
- Every send path (`lightningSendAsset`, `payLightningInvoice`) awaits
  `UtexoLsp.waitForOutboundLiquidity(minMsat, {timeoutMs: 60_000})`
  first — beta.20's answer to the "invalid request" wall we hit on
  freshly-received wallets.
- New screens:
  - `mobile/app/receive-rgb-ln.tsx` — input pair (sats + USDT base
    units), Generate → BOLT11 + RGB invoice tab view with QR + copy.
    Settlement row polls the LSP for 90s and renders waiting / settled
    / timed-out / error states; `AbortSignal` on the wait cancels the
    poll on unmount. LspChannelTimeoutError humanised ("Top up the
    wallet with on-chain tBTC first").
  - `mobile/app/send-rgb-ln.tsx` — paste/scan any invoice → auto-route
    by prefix (`lnbc`/`lntb` → `payLightningInvoice`, `rgb:`/`utxob:`
    → `lightningSendAsset`). Success card shows `txid` + LSP status.
- Action sheets: Send and Receive on `rgb_testnet` open a popup with
  the LN option. Both screens hard-gate to `NETWORK_RGB_TESTNET` so a
  deep link can't reach them on mainnet.
- Constants (`mobile/src/constants/rgb-lsp.ts`):
  - LSP base URL: `https://lsp-signet.utexo.com`
  - USDT asset id: `rgb:2l_MeWlj-YS7qLKQ-RJVhrQk-G6i4jZ4-EJOMAYZ-mpHfoqI`
    (the real one from the live faucet bot's `/getnodeinfo`; the value
    in `UTEXO-Protocol/rgb-sdk-rn-demo` does **not** exist on the
    running LSP).
  - Mainnet entries remain `null`; the screens render a config-error
    warning when either is null.

### Extension

Untouched. `rgb-sdk-web` still has no LSP/RLN build (latest = beta.9),
so LN is mobile-only by definition. The shared interface change is
non-breaking for ext.

## Verification

- `tsc --noEmit` clean on mobile and ext.
- RGB unit tests: 63/63 (`vitest run shared/tests/unit-vi/rgb-wallet.test.ts`).
- Mobile broader unit run has 16 failing files after the master merge
  (`@noble/hashes/sha2.js` subpath issue introduced by master's dep
  bumps, unrelated to RGB).
- iOS sim + android emulator both build green.

## Live verification (iOS sim1 + android emulator)

Both platforms **receive USDT over LN**:
- Persisted test wallets (`tasks/test-wallets-rgb.local.md`), funded
  via `node ~/z/rgb-faucet/bin/faucet.js getbtc <addr>`.
- Wallet1 (iOS) → Receive USDT over LN → LSP JIT channel + BOLT11 +
  RGB invoice rendered. Settlement poll ran to `timed_out` (no
  external payer in the self-loop, expected).
- Wallet2 (android) — same, after on-chain `sendBtc` from wallet1
  (25k sats) settled: RGB testnet balance updated, Receive USDT over
  LN opened its own JIT channel, both invoices rendered.

**Outbound LN pay via beta.20 — CONFIRMED (2026-07-14).** Pre-beta.20
every pay path returned HTTP 400 "invalid request" from the LSP.
beta.20 exposes `waitForOutboundLiquidity(minMsat, opts)` and the
adapter awaits it before every send. Verified end-to-end:

- wallet3 (`tunnel end magic forward marble rebel code rich case side love access`,
  new seed for the working state) received 100 UTST on-chain via
  `faucet getasset`, opened a 40k-sat colorable-channel to the RGB
  faucet bot (`0204aa30…@49.12.99.77:9737`) via the new /rgb-open-channel
  debug screen (colored channel, `assetAmount=100`, `pushAssetAmount=0`).
- Once the channel showed `usable=true`, paid a plain 3000-sat BOLT11
  from the bot via Send USDT over Lightning → `payLightningInvoice` →
  `waitForOutboundLiquidity` gate passed → LN send settled cleanly.

### P2P via the faucet bot as intermediary — DOES NOT ROUTE (2026-07-15)

Set up wallet3 (iOS) + wallet5 (android), each with its own colored
channel to the faucet bot (`0204aa30…@49.12.99.77:9737`), both
`usable=true`. Snapshots at
`~/z/layerzwallet/tasks/rgb-snapshots/{wallet3-ios,wallet5-android}-snapshot/`
(gitignored) so we can restore either wallet's LN state after any
Clear All Data / uninstall without re-faucet'ing.

Sanity — both work: `wallet3 → bot` invoice ✓, `wallet5 → bot`
invoice ✓ (both directly to the bot's node).

P2P via bot — both fail:

| direction | amount | asset | status |
| --- | --- | --- | --- |
| wallet3 iOS → wallet5 android | 500 sat | none | FAILED |
| wallet3 iOS → wallet5 android | 1001 sat | none | FAILED |
| wallet5 android → wallet3 iOS | 1000 sat | none | FAILED |
| wallet3 iOS → wallet5 android | 5000 sat | 3 UTST | FAILED |

Invoices generated via the new "P2P (own node)" toggle on
Receive over Lightning → `wallet.createLightningInvoice` (native RLN
node, not LSP-mediated) so the invoice's route hints point at the
bot as the wallet's only peer. `listPaymentsRaw` on the *receiver*
side shows the HTLCs as `INBOUND_AUTO_CLAIM PENDING`, and the sender
side flips them to `FAILED` — HTLCs reach the bot but never propagate
to the intended receiver.

**Conclusion:** the RGB faucet bot's LN node accepts payments to
itself but does not forward third-party HTLCs. Asked UTEXO in
their support chat whether the bot is meant to route, or whether
there's a separate public routing node to peer with. **P2P remains
untested end-to-end pending that answer.**

### Ideal LSP flow (for reference — what we'd do without the bot)

The LSP is what the RN SDK ships to abstract "I need a channel" for
the everyday user:

1. Fresh wallet, no channels, only on-chain BTC.
2. User taps Receive over LN → `lsp.receiveAsset()` returns a BOLT11
   with the LSP's pubkey in the route hints.
3. External payer sends → the LSP JIT-opens a channel to the user
   on-chain during the HTLC and forwards it.
4. First send afterwards calls `waitForOutboundLiquidity(minMsat)` to
   nudge the LSP into pushing outbound into the freshly-opened
   channel, then `payLightningInvoice` routes through it.
5. For P2P between two users of the same LSP, both wallets already
   peer with the LSP; either user's invoice has an LSP-only route
   hint, and the LSP forwards between the two channels.

Our current test setup opens channels straight to the bot instead,
bypassing the LSP entirely — which is why bot-as-intermediary P2P
doesn't route.

### Demo-mirror refactor + beta.23 (2026-07-20) — retest pending

Compared our adapter against UTEXO's reference `rgb-sdk-rn-demo` and
landed four alignment fixes (`4869a00d`):

1. `createLsp()` gated by `IRgbAdapterCreateParams.useLsp` (default
   true). `'Use LSP for RGB'` toggle in Tools persists
   `STORAGE_KEY_RGB_USE_LSP_<network>`; change requires Clear All
   Data + reimport because the LSP-attach decision is baked into
   node params at init().
2. `payLightningInvoice` shim only forwards `assetId`/`assetAmount`/
   `maxFee` when actually set (demo passes bare `{ lnInvoice }`).
3. `createNativeLnInvoice` no-asset branch uses the demo's sentinel
   `asset: { assetId: '', amount: 0 }` instead of `undefined`.
4. LSP outbound-liquidity fallback suppressed when the wallet was
   init'd without LSP.

Then bumped rgb-sdk-rn beta.20 → beta.23 (`1117345c`), rebuilt both
platforms via EAS local, reinstalled on the sims. **P2P retest with
this stack has not run yet** — that's the next live-test action.
Strategic note: production priority is the LSP flow (receive via
LSP-JIT, send via LSP channel, P2P between two LSP-attached wallets
routed BY the LSP). The bot-channel path exists only because the
faucet bot can't pay invoices; it is not the shipping architecture.

### Fixes that landed during live tests

1. Demo-repo signet USDT asset id (`rgb:YKIE…`) does not exist on the
   running LSP — real one from `/getnodeinfo` is `rgb:2l_MeWlj-…`
   (ticker UTST).
2. SDK network strings `'signet'` and `'utexo'` point at *different
   chains* — `signet` defaults to iriswallet's electrum + RGB proxy,
   `utexo` defaults to `esplora-api.utexo.com` + utexo proxy. The
   faucet / LSP / asset all live on the utexo chain. Adapter uses
   `'utexo'`.
3. `buildNodeParams` was keying `lspBaseUrl` off the pre-rename
   `signet` string, so it fell through to the `mainnet` bucket
   (null) and `createLsp` threw "lspBaseUrl not set". Lookup
   inverted.
4. The adapter pre-called `lsp.waitForChannel(assetId)` BEFORE
   `lsp.receiveAsset`. JIT channels are opened by the LSP *during*
   the receive request, so the pre-wait blocked forever on a fresh
   wallet. Dropped.
5. Concurrent `lazyInitWallet` calls both constructed a fresh
   `UTEXOWallet` against the same storageDirPath → the native
   binding rejected the second with "RLN node already exists". Dedupe
   the pending promise per (mnemonic, network).
6. Cold-start flow needed init() (not reinit()) because the binding's
   per-process init state is empty in a fresh process — reinit()
   skips signer.initNode which unlock() then complains about.
7. On any init/unlock failure the binding may already have registered
   the storageDirPath — call `wallet.destroy()` in the catch so the
   next attempt starts clean.
8. Swallow benign init errors ("conflict with current node state" /
   "already exists" / "already initialized") when the signer's
   initNode is called against existing on-disk keys; unlock still
   works.
9. beta.20 exposes `waitForOutboundLiquidity(minMsat)` — call it
   before every send so the LSP has time to make outbound available.
10. `RlnPayment.updatedAt`/`createdAt` (and same on `Transfer`) come
    back as unix seconds even though the SDK types don't specify a
    unit and older test fixtures used ms. Dividing by 1000 pushed
    every tx to Jan 1970 and off the Home top-3 list. Heuristic on
    `> 1e12 ⇒ ms` handles both; drop once
    [rgb-sdk-rn#48](https://github.com/UTEXO-Protocol/rgb-sdk-rn/issues/48)
    lands.
11. `RlnPayment.status` / `paymentType` come back UPPERCASE
    (`SUCCEEDED`, `OUTBOUND`) even though types say mixed-case.
    Normalize before matching.
12. `bolt11@1.4.1` doesn't know the signet prefix `lntbs` and
    throws "Unknown coin bech32 prefix"; pass a custom `{bech32:'tbs',…}`
    network object explicitly in the invoice-preview decoder.
13. Send screen was rendering a green checkmark on any non-throwing
    SDK response — a payment that returned `status: FAILED` looked
    like a success. Read the status field and branch red X / yellow
    clock / green check.
14. `payLightningInvoice` unconditionally called
    `UtexoLsp.waitForOutboundLiquidity` before every pay. Fine when
    the LSP channel is the only channel, but wastes 60s (or hangs)
    when the wallet has usable non-LSP channels. Skip the LSP gate
    when any usable channel already has ≥ minMsat outbound; fall
    back to the LSP nudge only when nothing else has capacity.
15. LN payments were folded into the tx list keyed by
    `ln:<paymentHash>` so a colored-channel send that also moved 1
    UTST surfaces the token transfer in the details sheet.
    `getCommonTransactions` was previously reading only
    `listTransactions` (on-chain) + `listTransfers` (RGB) — LN
    activity was invisible.
16. `fetchTokenBalances` now sums LN channel local asset amounts on
    top of on-chain spendable — opening a channel with
    `assetAmount=100` moves everything OFF the on-chain UTXOs and
    the Home token list previously showed 0 UTST for a wallet with
    98 UTST locked in a working channel.
17. Send screen "Payment pending" state now polls `listPaymentsRaw`
    every 3s and flips to Sent/Failed once the SDK observes the
    final HTLC outcome — otherwise the initial Pending sat forever
    even when the payment had long since failed.
18. Receive screen grew a "P2P (own node)" toggle that bypasses the
    LSP and generates a BOLT11 via `wallet.createLightningInvoice` —
    needed when the intended payer shares a peer with this wallet
    that isn't the LSP (e.g. the faucet bot in the current test
    loop). Also front-loads the LSP's 5000-sat minimum with a
    clearer error message.
19. Native invoice generation exposed as `IRgbWallet.createNativeLnInvoice`
    (new optional partial); wallet forwarder + adapter Proxy wire it
    through to `UTEXOWallet.createLightningInvoice`.
20. Debug/tools surface: `/rgb-open-channel` screen (opens a channel
    to an arbitrary pubkey@host:port with capacity + asset amount +
    push amount) plus per-channel Close / Force close buttons. Home
    "Channel" HomeActionButton (signet-only) drops you there.
21. Tools screen grew RGB Snapshot / Restore that copies
    `Documents/rgb/` ↔ `Documents/rgb-snapshot/` so a Clear All Data
    cycle doesn't wipe a hard-earned channel state. Restore warns
    to force-quit + relaunch (SDK per-process state bug —
    [rgb-sdk-rn#47](https://github.com/UTEXO-Protocol/rgb-sdk-rn/issues/47)).
22. `wipeAllRgbData` in the adapter now destroys every cached SDK
    wallet BEFORE removing the on-disk dir, so a subsequent init
    on the same seed doesn't race a stale native binding
    registration against a filesystem we just deleted.
23. Transaction details sheet shows `Rail: Lightning`, coloured
    status, and copyable Payment Hash for any `ln:` tx.
24. Invoice preview on Send resolves `assetId` → cached wallet
    ticker so a colored-channel invoice renders as "Asset: 1 UTST"
    instead of "1 units — rgb:2l_MeWlj…".
25. Menu labels: "Send USDT over Lightning" / "Receive USDT over
    Lightning" → "Send over Lightning" / "Receive over Lightning".
    A colored channel can carry any asset (or plain sats); hardcoding
    USDT was misleading.

### Pure-LSP smoke test (2026-07-23) — blocked on SDK bug #49

Fresh wallet6 (`turn green capable…`, android, `Use LSP: ON`, no bot
channels) walked the shipping LSP flow end-to-end:

1. ✅ Clear All Data → wipe → fresh create — no conflicts (wipe fix works)
2. ✅ Faucet 50k sats → confirmed → visible
3. ✅ `lsp.receiveAsset(5000 sats / 100 UTST)` → BOLT11 + rgbInvoice
   rendered, no errors (beta.23 + review-fix stack)
4. ✅ Faucet `/getasset` paid the rgbInvoice → 100 UTST landed at the
   LSP (asset goes to the LSP's blinded UTXO, NOT ours — confirmed by
   rgb-lib refresh staying empty)
5. ✅ LSP attempts LN delivery: `INBOUND_AUTO_CLAIM 5000 sats`
   (FAILED while wallet offline, PENDING once reconnected)
6. ✅ LSP sends `OpenChannel` JIT (funding 100k, push 5000 msat) from
   the registered virtual peer
7. ❌ **Our LDK force-closes it: `unsupported_scid_alias`** — the SDK's
   receiving node config rejects the channel_type the SDK's own LSP
   uses for JIT. No client-side knob exists. Filed
   [rgb-sdk-rn#49](https://github.com/UTEXO-Protocol/rgb-sdk-rn/issues/49);
   100 UTST currently stranded at the LSP under wallet6's mapping.
8. **Reproduced identically on iOS** (wallet7, `celery glove wrestle…`,
   funded on-chain from wallet6 to dodge the faucet's 24h getbtc
   limit): same double OpenChannel (`[0,16,64,0,0,64]` then `[0,16]`
   fallback), same force-close. Cross-platform ⇒ the LDK config in
   both RLN builds is the culprit, not a platform quirk. Second 100
   UTST batch now also stranded at the LSP (wallet7 mapping).

New debug surface added along the way: `waitForLspChannel` partial on
IRgbWallet + "Wait for LSP JIT channel" button on /rgb-open-channel.
Also confirmed the auto-`prepareWallet` colorable top-up runs on a
fresh wallet (its 5×1000 split was briefly mistaken for JIT funding).

Note for the ledger: hot-reload during testing still reproduces
rgb-sdk-rn#47 ("RLN node already exists" → "RLN node is not created")
— force-quit + relaunch remains the workaround.

## Known gaps / follow-ups

- **BLOCKER for prod: mobile VSS shim fakes backup success.**
  `shimVssMethods` no-ops `vssBackup` (returns 0) so
  `RgbWallet.tryBackup({critical:true})` "succeeds", resets
  `pendingMutations`, stamps `lastBackupAt` — the ledger claims the
  wallet is backed up while nothing is stored anywhere. Lost phone ⇒
  RGB allocations unrecoverable, and the warning banner the ledger
  exists to drive never fires. Deliberate stopgap (UTEXO removed VSS
  in beta.10+, promised its return), but before any release either
  (a) UTEXO ships cloud backup and we drop the shim, or (b) the shim
  must *fail* (throw / return backupExists:false consistently) so the
  banner shows "not backed up" instead of lying. Surfaced by branch
  review 2026-07-23.
- **Account switching is cosmetic on RGB.** The adapter dedupes
  wallets by (mnemonic, network) fingerprint — every accountNumber
  maps to the same RLN node and funds, while the backup ledger writes
  per-account keys, splitting one wallet's state across two keys.
  Same SDK limitation as Liquid ("hardcoded to account 0"). Decide:
  pin RGB to account 0 in `lazyInitWallet` (mirror Liquid) or derive
  a per-account child seed before handing it to the adapter.
  Surfaced by branch review 2026-07-23.

- **SDK bug: createUtxos rejects with "conflict with current node state"
  on freshly-imported wallet, only "create new wallet" flow works.**
  Reproduced on android (API 29) after a clean `adb uninstall + install`
  cycle: import seed → TOS → RGB Testnet → open UTXO Manager → tap
  Create → `org.utexo.rgblightningnode.RlnException.Conflict: conflict
  with current node state`. The error is emitted by the RN binding
  BEFORE the call reaches rgb-lib (rgb-lib log shows only INFO-level
  sync/list ops, no createUtxos entry). LDK log is clean.
  Force-quit + relaunch doesn't help; only creating a NEW wallet
  (different storagePath) works. Logs shared with UTEXO for
  investigation. If this is the same root cause as
  [rgb-sdk-rn#47](https://github.com/UTEXO-Protocol/rgb-sdk-rn/issues/47)
  (dispose leaves per-process state), it may collapse into the same
  fix; open its own issue once we hear back.
- **SDK ambiguity: timestamp units not documented**
  ([UTEXO-Protocol/rgb-sdk-rn#48](https://github.com/UTEXO-Protocol/rgb-sdk-rn/issues/48)).
  `RlnPayment.createdAt/updatedAt` and `Transfer.createdAt/updatedAt`
  come out of the native binding as unix seconds, but the TS types
  don't say so; test fixtures in the docs use ms. We handle both with
  a magnitude heuristic (`> 1e12 ⇒ ms`) — drop the heuristic and pick
  the SDK's canonical unit once the ambiguity is resolved.
- **SDK bug: dispose() doesn't clear per-process node state**
  ([UTEXO-Protocol/rgb-sdk-rn#47](https://github.com/UTEXO-Protocol/rgb-sdk-rn/issues/47)).
  After Clear All Data (which calls `wipeAllRgbData` → sdk.dispose + fs
  wipe) OR after a partial init failure, the native binding still holds
  a `storageDirPath` registration. The next `init()` throws "conflict
  with current node state". Only a full process kill clears it. Add a
  Metro / dev-only "Restart RN" affordance and, for prod, either wait
  for the SDK fix or force-terminate on Clear. Retest RGB flows once
  the issue closes — verify Clear + reimport works without app kill,
  AND partial init failures self-heal on retry.
- Full P2P (wallet3 iOS → wallet2 android via bot as routing intermediary):
  requires wallet2 to also have a usable channel to the bot / same LSP
  hub. Bootstrap wallet2 via UTXO Manager + `/rgb-open-channel` the same
  way wallet3 was, then relay a bot-issued asset invoice.
- Asset-tagged LN send: send USDT (not plain sats) via the bot. Bot
  supports asset invoices — `getinvoice` with argument prompts for
  asset amount. Wire that + verify `payLightningInvoice({assetId,
  assetAmount})` end-to-end.
- Mainnet entries in `rgb-lsp.ts` still `null`; mainnet LN flow hides
  itself behind that, but UTEXO needs to publish prod endpoints
  before mainnet ships.
- Cloud backup is TODO — beta.10+ removed VSS, UTEXO confirmed it's
  coming back. Adapter shims the old VSS methods as no-ops; reconnect
  the shared backup ledger when the SDK ships it (see TODO in
  `mobile/src/modules/rgb-adapter.ts`).
- After the network rename existing wallets (created against the
  `signet` network string before commit `7e07f099`) are on a different
  keychain derivation and won't see their old UTXOs. Reinstall +
  reimport from seed is the cleanest path; documented in the wallet
  commit.
- Master merge in `989e6084` / `18d93e43` brought a `@noble/hashes`
  transitive that breaks 16 test files (`sha2.js` subpath). Not RGB,
  but blocks the full unit suite locally. Master will presumably
  fix; if not, we ship the RGB tests separately.

## Commit log (rgb-two ⇢ origin/master)

76 commits total. Highlights (newest first):

```
18d93e43 Merge remote-tracking branch 'origin/master' into rgb-two
ef4310f4 feat(rgb): bump to rgb-sdk-rn beta.20 + wait for outbound liquidity
989e6084 Merge remote-tracking branch 'origin/master' into rgb-two
d16a113a chore: gitignore local rgb test wallet seeds
6c3c0f8e docs(rgb): pay-ln test — wallet1 can't pay anything outbound
3d0f53c2 docs(rgb): p2p attempt — receive works both sides, send blocked at lsp
e223fd2e fix(rgb): swallow benign init errors when keys already on disk
bd2972af fix(rgb): always init() — reinit() skipped initNode so unlock failed
d233b767 fix(rgb): destroy() the rln node on init/unlock failure
12d86cac fix(rgb): dedupe wallet construction per mnemonic+network
92273eea feat(rgb): pay bolt11 directly + auto-route send screen
f957c45b docs(rgb): todo for cloud-backup reconnect when utexo ships it
0a700b34 fix(rgb): mnemonic-derived port offset for the rln node
631989ef docs(rgb): record the e2e live test result + four fixes
19267ef7 fix(rgb): skip pre-waitForChannel — let receiveAsset trigger jit open
3cce9027 fix(rgb): lspBaseUrl lookup after signet→utexo network rename
7e07f099 fix(rgb): point adapter at the utexo chain, not iriswallet signet
b42b8de0 fix(rgb): use real signet asset id from live faucet, not demo repo value
6f5d1cad fix(rgb): reinit on cold start so unlock can find the rln node
747a0112 fix(rgb): abort the ln settlement poll on unmount
bd0b32ca fix(rgb): surface real txid from ln send, not the missing paymentHash
2ca5174e feat(rgb): humanize lsp channel timeout on ln receive screen
99ee6a00 fix(rgb): keep ln receive hooks unconditional + push gate later
fedaeab0 test(rgb): unit tests for the lightning forwarder methods
27f23bfb fix(rgb): tighten ln-screen gating + evict failed lsp promises
92fc0714 feat(rgb): settlement polling on the ln receive screen
b4b5a4d4 feat(rgb): usdt-over-ln send screen on signet
dfd54767 fix(mobile): pin @react-native-community/netinfo for bugsnag plugin
59ab9807 feat(rgb): populate signet lsp base url + usdt asset id
8583226f feat(rgb): usdt-over-ln receive screen on signet
72e8f492 chore(rgb): bump mobile to rgb-sdk-rn beta.17
d2652b15 Merge remote-tracking branch 'origin/master' into rgb-two
18ea222e feat(rgb): scaffold RGB-over-Lightning receive on mobile
f964f4d9 fix(rgb): drop _Nullable on Rgb.mm bitcoindRpcPort
34575999 chore(rgb): bump mobile to rgb-sdk-rn beta.14
6577da4a Merge remote-tracking branch 'origin/master' into rgb-two
d1902864 docs(rgb): assess rgb-sdk-rn beta.10 — do not bump
```
