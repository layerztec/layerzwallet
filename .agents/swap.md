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
executeTransfer(quote, settleAddress, fromAddress?): TransferExecution
getTimelineSteps(execution): TimelineStep[]
// Optional:
getPairInfo?(send, receive): TransferPairInfo (min/max)
commitTransfer?(execution): void
getOngoingTransfers?(): TransferExecution[]
refreshTransferStatus?(execution): TransferExecution
getTrackingUrl?(execution): string | undefined
```

### Key Types (`shared/types/transfer.ts`, `shared/types/asset.ts`)
- **AssetId** — strict union: `native:bitcoin`, `token:spark:usdb`, etc.
- **AssetInfo** — resolved metadata: network, ticker, decimals, tokenId
- **TransferQuote** — quote with `serviceName`, `serviceErrors?`
- **TransferExecution** — persisted transfer state with `depositAddress`, `relatedTxids`, `confirmations`, `claimSwapJson`, `providerId`
- **TransferStatus** — `waiting | pending | confirming | claimable | completed | failed | refunded | expired`

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
- **Tracking**: `garden.finance/explorer/?order={providerId}`
- Conditional on `EXPO_PUBLIC_GARDEN_APP_ID` env var

### Symbiosis (`shared/services/transfer-service-symbiosis.ts`)
- **Pairs**: BTC → Rootstock (working), BTC → Citrea (registered, no route yet)
- **Model**: Combined quote+execute API (`/v1/swap`). Deposit address with expiration.
- **API**: `shared/services/symbiosis-api.ts` — `api.symbiosis.finance/crosschain`, no auth
- **Chain IDs**: Bitcoin=3652501241, Rootstock=30, Citrea=4114
- **Tracking**: `explorer.symbiosis.finance/transactions/bitcoin/{txHash}`

### Flashnet AMM (`shared/services/transfer-service-flashnet.ts`)
- **Pairs**: BTC <-> USDB on Spark (both directions)
- **Model**: Instant atomic swap via `@flashnet/sdk`. No deposit address. Executes atomically in `executeTransfer()`.
- **API**: `FlashnetClient.simulateSwap()` for quotes, `executeSwap()` for execution
- **SparkWallet access**: `SparkWallet.getSDKWalletForAccount(accountNumber)` static getter
- No tracking URL (instant)

### NativeDeposit (`shared/services/transfer-service-native-deposit.ts`)
- **Pairs**: BTC → Ark, BTC → Spark
- **Model**: 1:1 quotes. Wallet-driven status via `swapsFetcher`. Boarding address as deposit.
- **Status flow**: waiting → confirming → claimable → completed
- **Claim**: Routes to `SwapXArkClaim` screen with serialized CommonSwap
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
3. **`confirm.tsx`** — Auto-prepares on mount (`executeTransfer` + `getSendQuote`). Shows rate, fee, est. time, expiry countdown, provider. Single "Confirm" tap. NativeDeposit: uses boarding address, skips auto-send. Flashnet: no deposit address, instant swap on prepare.
4. **`success.tsx`** — Pull-to-dismiss modal with checkmark animation.

### Components (`mobile/components/transfer/`)
- `TransferAmountSection.tsx` — send/receive input with fiat toggle
- `TransferAssetIcon.tsx` — colored icon with network badge
- `AssetSelectorPill.tsx` — `[icon] [ticker] [chevron]` or "Select >"
- `AssetListItem.tsx` — row in asset picker
- `OngoingTransferList.tsx` — polls every 10s, shows recent transfers
- `OngoingTransferItem.tsx` — status display with fiat values

### Detail Screen
- `mobile/app/TransferDetails.tsx` — Timeline from `getTimelineSteps()`. Detail rows: provider, status, transfer ID, addresses. Claim button for NativeDeposit. "View Online" button when tracking URL available.

## Shared Hooks
- `useTransferService(storage)` — singleton TransferServiceManager (`shared/hooks/useTransferService.ts`)
- `useTransactionHistory(network, account)` — merges transfers into tx list, deduplicates (`shared/hooks/useTransactionHistory.ts`)
- `useAssetExchangeRate(assetId)` — fiat rate for transfer assets (`shared/hooks/useAssetExchangeRate.ts`)
- `useAssetBalance(assetId, account, bg)` — unified native/token balance (`shared/hooks/useAssetBalance.ts`)

## Wallet Send Quote API
2-step API for sending on-chain funds to deposit addresses:
- **Types**: `SendQuoteRequest`, `SendQuote` (`shared/types/send-quote.ts`)
- **Interface**: `InterfaceSendQuotable` (`shared/class/wallets/interface-send-quotable.ts`)
- **Implementations**: `EvmWallet`, `BreezWallet`

## Tests
- `shared/tests/unit-vi/transfer-service-sideshift.test.ts` (23 tests)
- `shared/tests/unit-vi/transfer-service-garden.test.ts` (20 tests)
- `shared/tests/unit-vi/transfer-service-symbiosis.test.ts` (18 tests)
- `shared/tests/unit-vi/transfer-service-flashnet.test.ts` (11 tests)
- `shared/tests/unit-vi/transfer-service-manager.test.ts` (15 tests)
- `shared/tests/unit-vi/transfer-service-native-deposit.test.ts` (16 tests)
- `shared/tests/unit-vi/sideshift-mappings.test.ts` (9 tests)
- `shared/tests/unit-vi/use-transaction-history.test.ts` (8 tests)
- `shared/tests/unit-vi/use-asset-balance.test.ts` (6 tests)
- `shared/tests/integration-vi/sideshift-transfer.test.ts` (5 tests)
- `shared/tests/integration-vi/garden-transfer.test.ts` (5 tests)
- `mobile/.maestro/swap.yml` — e2e flow with Fake service

## Adding a New Transfer Service

1. Create `shared/services/transfer-service-{name}.ts` implementing `ITransferService`
2. Create API client `shared/services/{name}-api.ts` if needed
3. Create mappings `shared/services/{name}-mappings.ts` for AssetId conversion
4. Add storage key in `shared/types/IStorage.ts`
5. Register in `shared/hooks/useTransferService.ts` — add to `TransferServiceManager` constructor
6. Add tests in `shared/tests/unit-vi/transfer-service-{name}.test.ts`
7. No UI changes needed — TransferServiceManager handles routing automatically
