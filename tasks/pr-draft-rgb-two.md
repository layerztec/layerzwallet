# PR draft: RGB asset support (branch `rgb-two`)

## Summary

Adds RGB protocol support (on-chain assets + Lightning) to mobile and ext via
UTEXO's SDK, gated behind the "Show Testnets" toggle (`rgb_testnet`; the
mainnet RGB card fails fast until UTEXO publishes mainnet endpoints).

Pins: `@utexo/rgb-sdk-rn@1.0.0-beta.32` + `@utexo/rgb-sdk-core@1.0.0-beta.9`
(mobile, native rgb-lightning-node 0.13.0-beta.3 — on-device LDK node);
`@utexo/rgb-sdk-web@1.0.0-beta.9` (ext, rgb-lib model — LN scope is
mobile-only until UTEXO ships an RLN web build).

## What's included

**On-chain RGB** (mobile + ext): blind/witness invoices (receive with QR),
send (invoice auto-decode → amount → confirm), token balances on Home,
transaction history, UTXO manager (issue / fail pending / refresh),
asset issuance debug screen.

**Lightning over RGB** (mobile, signet): two-asset LSP flow against
`lsp-signet.utexo.com` — payout LNUSDT / bridge USDT with 1:1 conversion,
JIT channel open on first delivery; receive (BOLT11 + RGB invoice, settlement
polling), send (`rgb:` invoice + direct BOLT11 pay), lightning address
(enable / discover / pay), external BOLT11 invoices (request + pay + status).
LSP peer set explicitly from `get_info` (virtual channels off). LSP caps read
from `getInfo` at runtime.

**VSS cloud backup/restore**: node runs with `vssUrl` +
`vssAllowEmptyRestore:false`; `init → vssClearFence → unlock` order per
UTEXO's reference flow; real `backupNow()`; onboarding restore gate
("Verifying RGB backup…") with typed errors + Skip; backup ledger
(`pendingMutations` / `lastBackupAt` / error kinds) drives a persistent
banner; post-broadcast backup failures attach the txid.

**Resilience**: LSP outage degrades to no-Lightning (wallet still works);
VSS outage-class errors retry once without VSS (auth/corrupt/version errors
surface — a failed restore must not look like a fresh wallet); benign
re-init conflicts swallowed; per-mnemonic data dirs and ports.

## Key files

- `shared/class/wallets/rgb-wallet.ts` — wallet class: transfers, LN
  forwarders, token balances (LNUSDT channel balance as its own row),
  common transactions, backup ledger (`tryBackup`,
  `criticalBackupAfterBroadcast`).
- `shared/types/rgb-adapter.ts` — `IRgbAdapter` / `IRgbWallet` contracts.
- `mobile/src/modules/rgb-adapter.ts` — RLN node lifecycle (init/unlock,
  VSS, LSP attach, degraded modes), Proxy over `UTEXOWallet`.
- `mobile/src/constants/rgb-lsp.ts` — LSP/VSS URLs + asset ids per network
  (mainnet entries `null` until UTEXO publishes).
- `ext/src/modules/rgb-adapter.ts` — web adapter (rgb-lib + real VSS).
- Screens: `mobile/app/receive-rgb-token.tsx`, `send/send-*-usdt.tsx`,
  `receive-rgb-ln.tsx`, `send-rgb-ln.tsx`, `rgb-lightning-address.tsx`,
  `pay-rgb-address.tsx`, `request-rgb-external.tsx`, `pay-rgb-external.tsx`,
  `utxo-manager.tsx`, `rgb-open-channel.tsx` (debug); ext
  `SendRgb` / `ReceiveRgbToken` / `OnboardingVerifyingRgbBackup`.

## Test status (live on signet)

- On-chain send/receive/balances/history: green on Android + iOS
  (faucet → wallet, wallet → wallet).
- LN receive end-to-end: green on both platforms (invoice → LSP JIT channel
  ~5-7 min → `PaymentClaimed` → LNUSDT row on Home).
- Lightning address P2P pay between two of our wallets: green.
- Wipe → import seed → VSS restore: on-chain state and the LN channel
  restore correctly (funds not lost) — **but the node then deadlocks**, see
  #58 below. Lightning is unusable after a restore until UTEXO fixes it.
- Unit: `shared/tests/unit-vi/rgb-wallet.test.ts` green;
  integration suite green.

## Known issues (upstream)

| Issue | Impact |
|---|---|
| [rgb-sdk-rn#58](https://github.com/UTEXO-Protocol/rgb-sdk-rn/issues/58) — post-VSS-restore monitor-unlock deadlock (restored MPP claim blocks its own channel) | Node hangs forever after restoring a wallet with a claimed LN payment. 5 reproductions: dev + release builds, both platforms. Blocks the restore story for LN. |
| [rgb-sdk-web#6](https://github.com/UTEXO-Protocol/rgb-sdk-web/issues/6) — mobile-encrypted VSS payload undecodable on web | Cross-platform (mobile→ext) restore broken. |
| [rgb-sdk-web#7](https://github.com/UTEXO-Protocol/rgb-sdk-web/issues/7) — rgb-lib-wasm panics on fresh wallet's first `listAssets` | Blocks all ext RGB ops on a fresh wallet. |
| Keystore 0.11→0.13 incompatible ("unsupported version 233/103") | No in-place upgrade path; wipe → reimport → VSS restore required. Migration question open with UTEXO. |

Older beta.9-era issues (#20/#22/#24/#25/#28/#29) are superseded or closed
after the RLN rewrite; #47/#48 closed by UTEXO.

## Follow-ups before mainnet

See `tasks/ship-rgb.md` for the live checklist (UTEXO mainnet endpoints,
isTestnet flip, one-vs-two RGB networks decision, ext offscreen move).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01FP92tHMDN6ikaqeGhFjVkK
