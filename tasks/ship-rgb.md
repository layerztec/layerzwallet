# Ship RGB — live checklist

Branch: `rgb-two` (local only, no push without product sign-off). Both RGB
networks are `isTestnet: true` — hidden behind "Show Testnets" until the
blockers below clear. Feature summary: `tasks/pr-draft-rgb-two.md`.

Pins: `@utexo/rgb-sdk-rn@1.0.0-beta.32` + core beta.9, native
rgb-lightning-node 0.13.0-beta.3; ext on `@utexo/rgb-sdk-web@1.0.0-beta.9`.

## Blockers — UTEXO

1. **Mainnet endpoints unpublished**: indexer/proxy/transport, mainnet USDT
   asset id, VSS mainnet URL, (later) mainnet LSP. `rgb-lsp.ts` mainnet
   entries are `null`; adapter fails fast on mainnet until they land.
2. **rgb-sdk-rn#58** — post-VSS-restore monitor-unlock deadlock. Lightning
   dead after any restore. Must be fixed before LN ships anywhere.
3. **Keystore 0.11→0.13 break** — "unsupported version 233/103" on unlock;
   asked UTEXO whether an in-place migration is planned or wipe→restore is
   the official path. Matters for every future native bump.
4. **rgb-sdk-web#6/#7** — mobile→ext VSS restore undecodable; wasm panic on
   fresh wallet's first `listAssets`. Block any ext RGB launch.

## Blockers / decisions — ours

5. **One vs two RGB networks in the app.** UTEXO's soft-launch plan
   (2026-09-22) = on-chain USDT on mainnet + RLN kept on testnet. Options:
   (a) single RGB-mainnet card, LN screens gated off when `lspBaseUrl` is
   null (~day); (b) RGB-mainnet and RGB-testnet cards side by side (more
   visible, matches their plan better). Product decision needed.
6. **Mainnet flip**: set mainnet endpoints in
   `mobile/src/constants/rgb-lsp.ts`, drop the mainnet fail-fast guard in
   `mobile/src/modules/rgb-adapter.ts` `createWallet`, flip
   `isTestnet` for `NETWORK_RGB` in `shared/models/all-network-infos.ts`.
7. **Account switching is cosmetic on RGB** — adapter dedupes wallets by
   (mnemonic, network); every accountNumber maps to the same node. Same SDK
   limitation as Liquid. Decide: pin to account 0 (mirror Liquid) or derive
   per-account seeds.
8. **`vssBackupInfo` metadata probe** — dormant; revisit when UTEXO exposes
   backup metadata on the RLN surface (backup-lost detection).
9. **ext: move RGB out of the popup context** — today RGB runs in the popup
   (`background-message-controller.ts` throws if hit from the SW); closing
   the popup kills in-flight ops. Once web#7 lands, move to a Chrome MV3
   offscreen document (survives popup close; SW alone is worse — 30s idle
   eviction).

## Backup design (summary)

VSS is the only durable record; the guarded failure mode is silent
overwrite (fresh install + transient VSS outage → fresh wallet backs up
empty state over the real backup). Guards: per-network
`STORAGE_KEY_RGB_INITIALIZED` flag ("was here before" vs "first ever"),
typed errors (`RgbBackupLostError` / `RgbBackupServerUnreachableError`),
backup ledger + banner (`useRgbBackupStatus`), onboarding restore gate with
Skip that doesn't bypass the net. Degraded no-VSS retry fires only for
outage-class errors — auth/corrupt/version always surface.

## Reference implementations (check BEFORE wiring any new SDK surface)

- `/Users/limp/z/rgb-sdk-rn-demo` — canonical signet demo;
  `screens/apay-linked-asset-signet/useApayLinkedAssetSignetFlow.ts` is the
  full two-asset LSP flow, `config.ts` carries the signet asset ids.
- `/Users/limp/z/rgb-sdk-rn-sandbox` — e2e flows one file per surface under
  `flows/`; `flows/vss/runRlnUtexoVssFlow.ts` is the VSS
  create→dispose→restore→verify cycle (vssAllowEmptyRestore:false,
  vssClearFence between init and unlock).

Past saves: explicit-peer `createLsp(peer)` (virtual channels off) came from
the demo; the VSS fence/empty-restore alignment from the sandbox.

## Verification quick-resume

- Test wallets/seeds: `tasks/test-wallets-rgb.local.md` (gitignored).
  wallet13 (Android) and wallet14 (iOS) hold a claimed LN payment in VSS —
  ready-made repro for #58 (import seed → restore → hang).
- iOS sim: iPhone 17 Pro `597E4F02-2EE7-45D7-A185-266F99631F4B`; Android:
  `Pixel_API_29_AOSP` emulator (AOSP → `adb root` works for release-build
  logs). LDK log: `<app data>/rgb/testnet/<dir>/.ldk/logs/logs.txt`.
- Faucet (direct HTTP, not the Telegram bot):
  `node /Users/limp/z/rgb-faucet/bin/faucet-http.js getasset '<rgb invoice>'`
  — then keep calling `/refreshtransfers` until esplora sees the tx
  (sendrgb alone does not broadcast; confirmed expected behavior by UTEXO).
- EAS local release builds: run Android and iOS SEQUENTIALLY — parallel
  local builds flake the JS-bundle step.

## Smoke

```bash
cd mobile && npx vitest run shared/tests/unit-vi/rgb-wallet.test.ts
cd mobile && npx vitest run shared/tests/integration-vi/rgb-wallet.test.ts
```
