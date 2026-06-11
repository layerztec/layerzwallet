# Transfer/Swap Feature

Cross-chain transfer system enabling asset swaps between different networks via multiple providers. Multi-provider aggregation with best-rate selection.

## Architecture

### TransferServiceManager (`shared/services/transfer-service-manager.ts`)

Wraps N `ITransferService` implementations behind a single `ITransferService` interface. Zero UI changes needed when adding/removing providers.

- `getAvailableAssets()` — union of all services' assets, deduplicated
- `getSupportedPairs()` — union of all services' pairs, deduplicated
- `getQuote()` — queries ALL candidate services in parallel (`Promise.allSettled`), picks best rate, tags with `serviceName`. Collects `serviceErrors` for partial/total failures. 5s timeout per provider.
- `executeTransfer()` — routes to correct service via `quote.serviceName`
- `getOngoingTransfers()` — aggregates from all services, sorted by `createdAt` desc

Singleton via `useTransferService(storage)` hook (`shared/hooks/useTransferService.ts`).

### ITransferService Interface (`shared/types/transfer.ts`)

```
readonly name: string
getSupportedPairs(): TransferPair[]
getQuote(sendAsset, receiveAsset, amount): TransferQuote
executeTransfer(quote, accountNumber, settleAddress, fromAddress?): TransferExecution
commitTransfer(execution): void
getTimelineSteps(execution): TimelineStep[]
getOngoingTransfers(accountNumber): TransferExecution[]
// Optional:
getPairInfo?(send, receive): TransferPairInfo (min/max)
refreshTransferStatus?(executionId, accountNumber): TransferExecution
getTrackingUrl?(execution): string | undefined
```

### Key Types (`shared/types/transfer.ts`, `shared/types/asset.ts`)

- **AssetId** — strict union: `native:bitcoin`, `token:spark:usdb`, etc.
- **AssetInfo** — resolved metadata: network, ticker, decimals, tokenId
- **TransferQuote** — quote with `serviceName`, `serviceErrors?`
- **TransferExecution** — persisted transfer state with `depositAddress`, `depositTxid`, `confirmations`, `claimSwapJson`, `providerId`. Three variants: `DepositAddressExecution`, `NativeClaimExecution`, `InstantSwapExecution`
- **NativeClaimExecution** — extends base with `claimTxid`, `receiveTransferId`, `autoClaim`, `autoClaimAttempts`, `autoClaimError`, `lastAutoClaimAt`, `claimSwapJson`
- **SparkExitExecution** — extends base with `coopExitRequestId` (SSP request id), `coopExitTxid` (L1 txid once broadcast), `exitSpeed`
- **TransferStatus** — `waiting | pending | confirming | claimable | completed | failed | refunded | expired`
- **getRelatedTxids(exec)** — collects `depositTxid` + `claimTxid` + `receiveTransferId` + `coopExitTxid` for tx history deduplication

## Providers

### SideShift (`shared/services/transfer-service-sideshift.ts`)

- **Pairs**: BTC, Liquid BTC, Liquid USDT, Rootstock RBTC, Stacks STX — all cross-pairs
- **Model**: Fixed quotes only. Deposit address flow. 15-min quote expiry.
- **API**: `shared/services/sideshift-api.ts` — `sideshift.ai/api/v2`
- **Mappings**: `shared/services/sideshift-mappings.ts`
- **Fee**: Real spread `(depositAmount * rate) - settleAmount`
- **Tracking**: `sideshift.ai/orders/{providerId}`
- Affiliate ID: `uYB9AagC9`

### Garden Finance (`shared/services/transfer-service-garden.ts`)

- **Pairs**: BTC → Botanix only (reverse requires EVM tx signing — deferred)
- **Model**: Atomic swap deposit. Requires `fromAddress` for HTLC refund.
- **API**: `shared/services/garden-api.ts` — `api.garden.finance/v2`, auth via `garden-app-id` header
- **Mappings**: `shared/services/garden-mappings.ts`
- **Decimals**: bitcoin=8, botanix=18 (BigNumber.js conversion)
- **Tracking**: `explorer.garden.finance/order/{providerId}`
- Conditional on `EXPO_PUBLIC_GARDEN_APP_ID` env var

### Symbiosis (`shared/services/transfer-service-symbiosis.ts`)

- **Pairs**: BTC → Rootstock (working), BTC → Citrea (registered, no route yet)
- **Model**: Combined quote+execute API (`/v1/swap`). Deposit address with expiration.
- **API**: `shared/services/symbiosis-api.ts` — `api.symbiosis.finance/crosschain`, no auth
- **Chain IDs**: Bitcoin=3652501241, Rootstock=30, Citrea=4114
- **Tracking**: `explorer.symbiosis.finance/transactions/bitcoin/{txHash}`

### Flashnet AMM (`shared/services/transfer-service-flashnet.ts`)

- **Pairs**: BTC <-> USDB on Spark (both directions)
- **Model**: Two-phase instant swap. `executeTransfer()` stages params in `pendingSwaps` and returns `status: 'pending'` _without_ moving funds. `executeInstantSwap(executionId)` then runs `FlashnetClient.executeSwap()` and returns `status: 'completed'`. This split lets the UI / MCP show fee + impact before commit.
- **API**: `FlashnetClient.simulateSwap()` for quotes, `executeSwap()` for execution
- **Fees**: Derived from the pool's configured `lpFeeBps + hostFeeBps` (read from the cached `AmmPool` after `listPools`), as `amountIn × totalFeeBps / 10000`. `TransferQuote.feeBaseUnits` is then in the input asset's smallest units. **We deliberately do NOT use `SimulateSwapResponse.feePaidAssetIn`** — despite the name suggesting input-asset units, empirically the field is denominated in the OUTPUT asset's smallest units, which on a real BTC→USDB swap caused us to report a ~38% fee on a pool actually configured for 5 bps. The pool-bps approach is unit-unambiguous and direction-symmetric. **Price impact is NOT a fee** — exposed separately on `TransferQuote.priceImpactPct`.
- **Slippage**: `maxSlippageBps: 300` + hard `minAmountOut = receiveAmount * 0.97`.
- **SparkWallet access**: `SparkWallet.getSDKWalletForAccount(accountNumber)` static getter
- No tracking URL (instant)

### SparkExit (`shared/services/transfer-service-spark-exit.ts`)

- **Pairs**: `native:spark` → `native:bitcoin` (one-way — BTC→Spark is handled by NativeDeposit)
- **Model**: Two-phase stage-then-commit, like Flashnet, but the commit is **async** rather than instant. `executeTransfer()` stages the quote's `feeQuoteId` / `feeAmountSats` / `exitSpeed` / destination address in memory and returns `status: 'pending'` with no `coopExitRequestId` yet. `executeInstantSwap(executionId)` calls the SDK's `wallet.withdraw()` — _this_ is the point of no return (funds commit on Spark side). After commit, the SSP signs and broadcasts an L1 transaction asynchronously; `refreshTransferStatus()` polls `wallet.getCoopExitRequest(coopExitRequestId)` and walks the execution through `pending → confirming → completed`.
- **API**: `SparkWallet` SDK — `getWithdrawalFeeQuote()` for quotes, `withdraw()` for the irreversible commit, `getCoopExitRequest()` for status polling.
- **Exit speed**: Hard-coded to `'MEDIUM'` for v1. The SDK returns FAST/MEDIUM/SLOW tiers in a single quote; if we ever surface a speed picker, just stash all three on the staged quote and pick at commit time.
- **Fees**: `userFeeMedium + l1BroadcastFeeMedium` from the SDK quote, both in sats. We use `deductFeeFromWithdrawalAmount: true` in `withdraw()` so the recipient receives exactly the `receiveAmount` we showed in the quote.
- **Quote-time side effect**: `getWithdrawalFeeQuote()` may restructure the wallet's leaves via an SSP swap to produce correctly-denominated leaves for `amountSats`. This is unavoidable per SDK design — relied on so the fee quote reflects what `withdraw()` will actually consume. Mitigation: index.tsx's 500ms debounce ensures we only quote on stable amounts.
- **Quote-time destination address**: `getQuote()` runs _before_ the user reaches `confirm.tsx`, so we don't have their real BTC address yet. We use the BIP173 spec P2WPKH test vector (`bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4`) as a placeholder — the SDK fee is amount-bound, not address-bound (output script size is identical for any real P2WPKH/P2TR/P2WSH receive address), so the fee shown matches the actual withdrawal within sub-sat noise. The real address is bound at `withdraw()` time via `onchainAddress`.
- **SDK status → TransferStatus mapping**: `INITIATED`/`INBOUND_TRANSFER_CHECKED`/`TX_SIGNED` → `pending` · `TX_BROADCASTED`/`WAITING_ON_TX_CONFIRMATIONS` → `confirming` · `SUCCEEDED` → `completed` · `EXPIRED` → `expired` · `FAILED` → `failed`
- **Execution variant**: `SparkExitExecution` (new `EXECUTION_SPARK_EXIT` discriminant) with `coopExitRequestId`, `coopExitTxid`, `exitSpeed`. `getRelatedTxids()` includes `coopExitTxid` so the L1 tx deduplicates against Bitcoin tx history.
- **SparkWallet access**: same getter as Flashnet — `SparkWallet.getSDKWalletForAccount(accountNumber)`
- **Tracking URL**: mempool.space (`AllNetworkInfos[NETWORK_BITCOIN].explorerUrl + '/tx/' + coopExitTxid`) once the SSP broadcasts.
- **MCP**: not exposed. The async lifecycle doesn't fit `execute_swap`'s instant-swap contract. A separate `request_btc_withdrawal` MCP tool is the natural extension if needed.

### NativeDeposit (`shared/services/transfer-service-native-deposit.ts`)

- **Pairs**: BTC → Ark, BTC → Spark
- **Model**: 1:1 quotes. Wallet-driven status via `swapsFetcher`. Boarding/deposit address as deposit.
- **Status flow**: `waiting → confirming → claimable → completed` (or `→ refunded`)
- **Auto-claim**: Monitors claimable transfers and claims automatically when enabled:
  - `AutoClaimMonitor` component (`mobile/components/AutoClaimMonitor.tsx`) — renderless, mounts in root provider tree. Defers startup 5s + `requestIdleCallback`. Triggers on: app start, app foreground, 60s interval.
  - ARK: passive — SDK `VtxoManager` auto-settles boarding UTXOs; executor polls `getSettledBoardingAmount()` and returns result when ready (no manual claim in auto path). Claim toggle hidden for ARK (always auto).
  - Spark: active — executor calls `getDepositQuote()` + `claimDepositSpark()` and returns `{ receiveTransferId, creditAmountSats }`
  - Retry: max 5 attempts, 5min cooldown. Transient errors (429, timeouts, fetch failures) don't count against limit.
- **Manual claim**: `SwapXArkClaim` screen with serialized CommonSwap (when `autoClaim=false` on Spark)
- No tracking URL

### Fake (`shared/services/transfer-service-fake.ts`)

- **Pairs**: Liquid Testnet BTC <-> Botanix Testnet BTC
- **Model**: Dev/test stub. Instant completion. Throws error when amount=1.
- Only available in `__DEV__` mode

## UI Flow (mobile)

**Entry**: "Transfer" button on Home → `/transfer`

### Screens (`mobile/app/transfer/`)

1. **`index.tsx`** — Input screen. Bidirectional quote (type in either field). 500ms debounce. Min/max validation via `getPairInfo`. Balance check before confirm (skipped for testnets). Shows `serviceErrors` warnings for partial provider failures.
2. **`select-asset.tsx`** — Asset picker modal. Filters testnet assets via settings.
3. **`confirm.tsx`** — Auto-prepares on mount (`executeTransfer` + `getSendQuote`). Shows rate, fee, est. time, expiry countdown, provider. Single "Confirm" tap. NativeDeposit: uses boarding address, auto/manual claim toggle (hidden for ARK — always auto). Flashnet / SparkExit: no deposit address, staged params on prepare; Confirm tap calls `transferService.executeInstantSwap(execution.id)` (the manager routes by execution id). For Flashnet this is the synchronous AMM trade; for SparkExit this is the SDK `withdraw()` that initiates the L1 broadcast, after which the transfer enters the ongoing list in `pending`/`confirming` and polls to completion.
4. **`success.tsx`** — Pull-to-dismiss modal with checkmark animation.

### Components (`mobile/components/transfer/`)

- `TransferAmountSection.tsx` — send/receive input with fiat toggle
- `TransferAssetIcon.tsx` — colored icon with network badge
- `AssetSelectorPill.tsx` — `[icon] [ticker] [chevron]` or "Select >"
- `AssetListItem.tsx` — row in asset picker
- `OngoingTransferList.tsx` — polls every 10s, shows recent transfers
- `OngoingTransferItem.tsx` — status display with fiat values

### Detail Screen

- `mobile/app/TransferDetails.tsx` — Timeline from `getTimelineSteps()`. Detail rows: provider, status, transfer ID, addresses, deposit/claim txids. Claim button for NativeDeposit (disabled during auto-claim). "View Online" button when tracking URL available.

## Shared Hooks

- `useTransferService(storage)` — singleton TransferServiceManager (`shared/hooks/useTransferService.ts`). Also exports: `setNativeDepositSwapsFetcher`, `setNativeDepositClaimExecutor`, `startAutoClaimMonitor`, `stopAutoClaimMonitor`, `processAutoClaimsNow`, `setFlashnetAccountNumber`, `setSparkExitAccountNumber`, `getTransferServiceManager` (non-hook singleton accessor — used by MCP).
- `useTransactionHistory(network, account)` — merges transfers into tx list, deduplicates (`shared/hooks/useTransactionHistory.ts`)
- `useAssetExchangeRate(assetId)` — fiat rate for transfer assets (`shared/hooks/useAssetExchangeRate.ts`)
- `useAssetBalance(assetId, account, bg)` — unified native/token balance (`shared/hooks/useAssetBalance.ts`)

## Wallet Send Quote API

2-step API for sending on-chain funds to deposit addresses:

- **Types**: `SendQuoteRequest`, `SendQuote` (`shared/types/send-quote.ts`)
- **Interface**: `InterfaceSendQuotable` (`shared/class/wallets/interface-send-quotable.ts`)
- **Implementations**: `EvmWallet`, `BreezWallet`

## MCP swap surface (`mobile/src/features/mcp/modules/mcp-calls.ts`)

Two tools expose Flashnet to remote AI agents. They run on `MCP_BALANCE_ACCOUNT_NUMBER` (= 4141) so they don't touch the user's primary account.

- **`get_swap_quote(send_asset, receive_asset, send_amount_base_units)`** — `send_asset` / `receive_asset` are strict `AssetId` strings (currently `native:spark` / `token:spark:usdb`). Internally: `lazyInitWallet(NETWORK_SPARK, 4)` → `setFlashnetAccountNumber(4)` → `manager.getQuote()` → `manager.executeTransfer()` (Flashnet: stages params, no funds movement — in-memory only, NOT persisted). Returns `{ quote_id, send_amount_base_units, receive_amount_base_units, fee_base_units, fee_asset, fee_ticker, price_impact_pct, rate, estimated_time_seconds, expires_at_unix, service }`.
- **`execute_swap(quote_id)`** — `manager.executeInstantSwap(quote_id)` → `commitTransfer()` (persists completed row). The manager looks up the owning service from `executionOwners` (populated in `executeTransfer`), so the agent only needs `quote_id`. Idempotency: the manager pops the owner entry on execute and the owning service pops the quote from its pending map; replay fails with _"No pending swap found"_. Quote expiry is enforced by Flashnet's internal `PENDING_SWAP_TTL` (5 min) on top of `TransferQuote.expiresAt` (60 s).

Adding more pairs is purely additive: extend `MCP_SWAP_ASSET_IDS` and ensure the relevant provider quotes the pair and implements `executeInstantSwap`. The manager routes by `executionOwners` so any such provider works without touching the MCP layer.

## Tests

- `shared/tests/unit-vi/transfer-service-sideshift.test.ts`
- `shared/tests/unit-vi/transfer-service-garden.test.ts`
- `shared/tests/unit-vi/transfer-service-symbiosis.test.ts`
- `shared/tests/unit-vi/transfer-service-flashnet.test.ts`
- `shared/tests/unit-vi/transfer-service-spark-exit.test.ts`
- `shared/tests/unit-vi/transfer-service-manager.test.ts`
- `shared/tests/unit-vi/transfer-service-native-deposit.test.ts`
- `shared/tests/unit-vi/sideshift-mappings.test.ts`
- `shared/tests/unit-vi/use-transaction-history.test.ts`
- `shared/tests/unit-vi/use-asset-balance.test.ts`
- `shared/tests/integration-vi/sideshift-transfer.test.ts`
- `shared/tests/integration-vi/garden-transfer.test.ts`
- `mobile/src/tests/unit-vi/mcp-calls-swap.test.ts` — MCP `get_swap_quote` / `execute_swap` handlers
- `mobile/.maestro/swap.yml` — e2e flow with Fake service

## Adding a New Transfer Service

1. Create `shared/services/transfer-service-{name}.ts` implementing `ITransferService`
2. Create API client `shared/services/{name}-api.ts` if needed
3. Create mappings `shared/services/{name}-mappings.ts` for AssetId conversion
4. Add storage key in `shared/types/IStorage.ts`
5. Register in `shared/hooks/useTransferService.ts` — add to `TransferServiceManager` constructor
6. Add tests in `shared/tests/unit-vi/transfer-service-{name}.test.ts`
7. No UI changes needed — TransferServiceManager handles routing automatically
