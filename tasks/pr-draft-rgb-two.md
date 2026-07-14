# RGB: bump to rgb-sdk-rn beta.20 + USDT-over-Lightning on signet

Branch: `rgb-two`. 76 commits ahead of `origin/master`. Local only —
do not push without product sign-off.

## What changed

- **Mobile RGB SDK bump**: `@utexo/rgb-sdk-rn` beta.9 → **beta.20** (and
  `@utexo/rgb-sdk-core` beta.3 → beta.4). Every beta.10 blocker
  (`tasks/ship-rgb.md` "beta.10 assessment") resolved by beta.11+; the
  cross-platform `IRgbAdapter` shape holds against a beta.9 extension
  and a beta.20 mobile at the same time.
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

**Still pending:** asset-tagged invoice via `faucet raw "/getinvoice" <amt>`
and the full android-side P2P (wallet3 iOS → wallet2 android via bot as
routing intermediary, or two wallets to a shared node).

**Practical note (see `tasks/test-wallets-rgb.local.md`):** the working
state on `597E4F02-…` sim is snapshotted at `Documents/rgb-snapshot/`
via Tools → RGB Snapshot. `Restore` + force-quit lets any later Clear
All Data cycle come back to the same channel without re-requesting
100 UTST from the faucet.

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

## Known gaps / follow-ups

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
