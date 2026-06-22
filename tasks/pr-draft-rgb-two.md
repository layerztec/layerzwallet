# RGB: bump to rgb-sdk-rn beta.17 + USDT-over-Lightning on signet

Branch: `rgb-two`. Local only — do not push without product sign-off.

## What changed

- **Mobile RGB SDK bump**: `@utexo/rgb-sdk-rn` beta.9 → **beta.17** (and
  `@utexo/rgb-sdk-core` beta.3 → beta.4). All previously documented
  blockers from the beta.10 assessment (`tasks/ship-rgb.md` history)
  resolved by beta.11+; see the doc's "Current state (2026-06-19)" section
  for the per-blocker breakdown.
- **Mobile adapter rewrite** (`mobile/src/modules/rgb-adapter.ts`): new
  RLN-backed `UTEXOWallet` constructor (`UTEXOWalletNodeParams` +
  `PasswordRLNSigner`), filesystem-sentinel `init() / unlock()` flow,
  `resolveUnlockParams` for indexer defaults, Proxy that shims the old
  `vssBackup*` methods to no-ops so the shared `IRgbAdapter` shape still
  spans mobile (SDK-managed VSS) and ext (real VSS on beta.9).
- **Patches**: dropped the beta.9 and beta.14 `Rgb.mm` `_Nullable` patches
  — upstream fixed both natively. `mobile/patches/` now carries zero
  rgb-sdk-rn entries.

### Lightning integration (USDT, signet only)

- `IRgbWallet` got `Partial<IRgbLnReceive>` — three asset-aware methods:
  `lightningReceiveAsset`, `lightningSendAsset`,
  `awaitLightningReceiveSettlement`. Mobile delegates each to a cached
  `UtexoLsp` (one-per-wallet `WeakMap`, with rejected-promise eviction so
  a transient network blip doesn't permanently poison the cache).
- New screens:
  - `mobile/app/receive-rgb-ln.tsx` — input pair (sats + USDT base units),
    Generate → BOLT11 + RGB invoice tab view with QR + copy. Settlement
    row polls the LSP for 90s and renders waiting / settled / timed-out
    / error states.
  - `mobile/app/send-rgb-ln.tsx` — paste/scan an `rgb:` invoice → Send →
    success card with `paymentHash` + LSP status echo.
- Action sheets: Send and Receive on `rgb_testnet` open a popup with the
  LN option. Both screens hard-gate to `NETWORK_RGB_TESTNET` so a deep
  link can't reach them on mainnet.
- Constants (`mobile/src/constants/rgb-lsp.ts`) lifted from
  `UTEXO-Protocol/rgb-sdk-rn-demo`:
  - LSP base URL: `https://lsp-signet.utexo.com`
  - USDT asset id: `rgb:YKIEjkhU-iqVFK0y-bfDUio6-bukqH7o-dxjctKB-5TuQ7aM`
  - Mainnet entries remain `null`; the screens render a config-error
    warning when either is null.

### Extension

Untouched. `rgb-sdk-web` still has no LSP/RLN build (latest = beta.9), so
LN is mobile-only by definition. The shared interface change is
non-breaking for ext.

## Verification

- `tsc --noEmit` clean on mobile and ext.
- 491 mobile unit tests pass (+6 new under `RgbWallet > lightning`).
- iOS sim build green; live tested the LN receive screen with maestro —
  adapter call resolved to the LSP, `lsp.connect()` succeeded against
  `lsp-signet.utexo.com`, `waitForChannel(USDT)` ran the full 120s
  timeout (expected: signet wallet had no on-chain tBTC; JIT inbound
  channel needs the wallet to be funded first). UI rendered the
  resulting `LspChannelTimeoutError` cleanly.
- Android `assembleDebug` green.

## Known gaps / follow-ups

- Faucet: the new `node ~/z/rgb-faucet/bin/faucet.js` (drives the
  `@Utexo_RLN_bot` Telegram bot) delivers tBTC reliably; UTEXO esplora
  confirms the on-chain receive.
- Two debugging discoveries late in the loop:
  1. The signet USDT asset id used by the LSP is **not** the value in
     `UTEXO-Protocol/rgb-sdk-rn-demo` (`rgb:YKIE…`) — that asset doesn't
     exist on the running LSP. The live faucet bot's `getnodeinfo`
     returns `rgb:2l_MeWlj-…` (ticker UTST). Constants updated.
  2. The SDK's network string `'signet'` and `'utexo'` point at
     *different chains* — `signet` defaults to iriswallet's electrum +
     RGB proxy, `utexo` defaults to `esplora-api.utexo.com` + utexo
     proxy. The faucet / LSP / asset all live on the utexo chain.
     Adapter now uses `'utexo'`. Pre-fix wallets need a reinstall
     (different keychain derivation per chain).
- Live end-to-end roundtrip (BOLT11 paid → RGB asset settled) still
  pending — both fixes need a clean app reinstall to verify.
- Android live test of the LN screens not done (compile-only).
- Mainnet entries in `rgb-lsp.ts` still `null`; mainnet LN flow hides
  itself behind that, but UTEXO needs to publish prod endpoints before
  mainnet ships.

## Commit log (rgb-two ⇢ origin/master)

```
fedaeab0 test(rgb): unit tests for the lightning forwarder methods
27f23bfb fix(rgb): tighten ln-screen gating + evict failed lsp promises
d9a06fed docs(rgb): refresh ship-rgb.md for beta.17 + ln integration
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
