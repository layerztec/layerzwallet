# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Layerz Wallet is a Bitcoin-focused multi-platform wallet supporting multiple Layer 2 solutions. It's architected as a monorepo with three main directories:

- **`mobile/`** - React Native (Expo) app for iOS/Android
- **`ext/`** - Chrome browser extension (popup + background script)
- **`shared/`** - Shared business logic, wallet implementations, network abstractions, and types

Both `mobile/` and `ext/` import from `shared/` via symbolic links (`src/shared-link -> ../../shared`), ensuring a single source of truth for all wallet logic.

## Development Commands

### Extension (`ext/`)

```bash
cd ext
source ../../env.sh      # Enviroment file
npm install              # Install dependencies
npm start                # Start dev server (builds and watches)
npm run build            # Production build
npm run unit             # Run unit tests (vitest)
npm run integration      # Run integration tests (vitest)
npm run e2e              # Run end-to-end tests (Playwright)
npm run test             # Run all tests + circular dependency check
npm run lint             # Check code formatting and types
npm run lint:fix         # Auto-fix linting issues
npm run circular         # Check for circular dependencies
```

Load extension in Chrome:
1. Navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked extension"
4. Select the `ext/build` folder

### Mobile (`mobile/`)

```bash
cd mobile
source ../../env.sh      # Enviroment file
npm install              # Install dependencies
npm start                # Start Expo dev server
npm run android          # Run on Android
npm run ios              # Run on iOS
npm run unit             # Run unit tests (vitest)
npm run integration      # Run integration tests (vitest)
npm run e2e              # Run Maestro e2e tests
npm run lint             # Check code formatting and types
npm run lint:fix         # Auto-fix linting issues
```

EAS builds:
If you are on macos prefer ios
Android: 
- Development build: `eas build --platform android --profile development-simulator --local`
- Preview build: `eas build --platform android --profile preview --local`
iOS:
- Development build: `eas build --platform ios --profile development-simulator --local`
- Preview build: `eas build --platform ios --profile preview --local`

## Architecture

### Monorepo Structure

Each platform implements platform-specific adapters while sharing core logic:

- **Storage**: Both implement `IStorage` interface
  - `mobile`: AsyncStorage (LayerzStorage) + Expo SecureStore (SecureStorage)
  - `ext`: chrome.storage.local for both LayerzStorage and SecureStorage

- **Background Execution**:
  - `mobile`: Direct execution (single JS context)
  - `ext`: Message-passing between popup and background script via BackgroundCaller/BackgroundMessageController

### Wallet Class Hierarchy

All wallets extend from `AbstractWallet` with specialized implementations:

```
AbstractWallet (base class - balance, UTXOs, transactions)
├── LegacyWallet (adds coinselect for UTXO selection)
│   └── AbstractHDWallet (adds HD wallet functionality)
│       └── AbstractHDElectrumWallet (adds Electrum connectivity)
│           ├── HDSegwitBech32Wallet (BIP84)
│           ├── SegwitP2SHWallet (BIP49)
│           ├── TaprootWallet (BIP86)
│           └── WatchOnlyWallet (xpub-only, wraps HD wallet)
│
├── EvmWallet (standalone - handles ALL EVM chains)
├── BreezWallet (Liquid Network via Breez SDK)
├── ArkWallet (extends AbstractHDElectrumWallet)
├── SparkWallet (extends ArkWallet, adds Spark-specific features)
└── StacksWallet (standalone - Stacks blockchain)
```

### Layer2 Implementation Patterns

Each Layer2 follows a specific pattern:

**Bitcoin (UTXO-based)**
- Uses `WatchOnlyWallet` wrapping `HDSegwitBech32Wallet`
- BIP84 derivation: `m/84'/0'/{account}'`
- Electrum server (electrum.layerzwallet.com) for balance/tx/UTXO queries
- Gap limit of 20 for address discovery

**EVM Chains (Rootstock, Botanix, Citrea, Alpen)**
- Single `EvmWallet` class handles ALL EVM chains
- HD path: `m/44'/60'/0'/0/{account}`
- Uses ethers.js JsonRpcProvider
- EIP-1559 and legacy transaction support
- Token transfers via ERC20 interface
- Implements EIP-1193 provider for dApp integration

**Liquid (Account-based, Lightning-capable, Token-capable)**
- Uses Breez SDK with native module (mobile) or web worker adapter (ext)
- Supports both Lightning and on-chain Liquid transactions
- Asset balance tracking (L-BTC + tokens)
- Hardcoded to account 0 (SDK limitation)

**ARK (Account-based, Lightning-capable)**
- Uses @arkade-os/sdk with custom storage adapter
- Single identity derived from `m/86'/0'/{account}'/0/0`
- Supports boarding (deposit), transfers, Lightning swaps via Boltz
- VTXO management with auto-renewal
- Two implementations: mainnet (arkade.computer) and testnet (mutinynet)

**Spark (Account-based, Lightning-capable, Token-capable)**
- Extends `ArkWallet` architecture
- Account number has +1 offset (SDK starts at 1, we start at 0)
- Static deposit address for onboarding
- Token support via TokenBalanceMap

**Stacks**
- Uses @stacks/wallet-sdk
- Treats sBTC token as "main balance"
- STX shown as a regular token
- NFT support via Gamma API
- Contract call transactions for token transfers

### Wallet Traits (Interfaces)

Wallets implement interfaces for feature detection:

- `InterfaceLightningWallet` - supports Lightning payments
- `InterfaceAccountBasedWallet` - account-based (non-UTXO) wallets
- `InterfaceCanHaveTokens` - supports token transfers

Use type guards: `walletSupportsLightning()`, `walletCanHaveTokens()` for runtime checks.

### Lazy Wallet Initialization

Wallets are initialized on-demand and cached in memory:

1. `backgroundCaller.lazyInitWallet(network, accountNumber)` called by React hooks
2. Check cache: `cachedWallets[network][accountNumber]`
3. If not cached:
   - Try deserialize from storage
   - If not in storage, create fresh wallet from seed
   - For account-based wallets: async SDK initialization happens here
4. Cache and return wallet instance

**Important**: Locking mechanism prevents concurrent initialization of the same wallet.

### React Hooks Architecture

All data fetching uses SWR for caching and auto-refresh:

**Core Hooks** (in `shared/hooks/`):
- `useBalance(network, accountNumber)` - wallet balance
- `useTokenDiscovery(network, accountNumber)` - discover tokens for account-based wallets
- `useTokenBalance(tokenId, network, accountNumber)` - specific token balance
- `useTransactions(network, accountNumber)` - transaction history
- `useSwaps(network, accountNumber)` - ARK/Spark deposits and swaps
- `useExchangeRate(network)` - fiat exchange rates

**Context Providers**:
- `InitializationContext` - app lifecycle (LOADING → INTRO → TOS → UNLOCK_PASSWORD → READY)
- `NetworkContext` - currently selected network
- `SettingsContext` - user settings
- `AccountNumberContext` - current account number

### Network Layer

**Network Definitions** (`shared/types/networks.ts`):
```typescript
const NETWORK_BITCOIN = 'bitcoin'
const NETWORK_ROOTSTOCK = 'rootstock'
const NETWORK_LIQUID = 'liquid'
const NETWORK_SPARK = 'spark'
const NETWORK_ARK = 'arkade'
// ... etc
```

**Network Metadata** (`shared/models/all-network-infos.ts`):
Each network has: `chainId`, `ticker`, `decimals`, `explorerUrl`, `rpcUrl`, `isEVM`, etc.

**API Clients**:
- **EVM**: `getRpcProvider(network)` returns ethers.js JsonRpcProvider
- **Bitcoin**: `BlueElectrum` singleton WebSocket client with auto-reconnect
- **Liquid**: Breez SDK (globalThis.breezAdapter)
- **Spark**: Spark SDK (globalThis.sparkAdapter)
- **ARK**: ARK SDK with custom storage adapter
- **Stacks**: Stacks blockchain-api-client

### Storage and Encryption

**Storage Keys** (defined in `IStorage.ts`):
```typescript
STORAGE_KEY_MNEMONIC = 'MNEMONIC'
STORAGE_KEY_EVM_XPUB = 'EVM_XPUB'
STORAGE_KEY_BTC_XPUB = 'BTC_XPUB'
STORAGE_KEY_SELECTED_NETWORK = 'STORAGE_SELECTED_NETWORK'
STORAGE_KEY_ACCEPTED_TOS = 'STORAGE_KEY_ACCEPTED_TOS'
```

**Encryption Flow**:
1. User creates/imports mnemonic → stored in SecureStorage (unencrypted initially)
2. User sets password → `encrypt(mnemonic, password, deviceId)` → saves with `ENCRYPTED_PREFIX`
3. On unlock: `decrypt()` → masterSeed cached in memory
4. masterSeed used to derive all wallet keys

**Wallet Serialization**:
After operations that modify wallet state (send, receive), call `wallet.serialize()` and save to storage. This pattern is critical for preserving state across app restarts.

### Common Data Structures

- **CommonTransaction**: Unified transaction format across all networks (time, hash, value, type, fee, etc.)
- **CommonSwap**: Unified swap/deposit tracking for ARK and Spark
- **CachedTokenInfo**: Token metadata + balance
- **StringNumber**: Type alias for bigint-safe number strings (used for amounts)

### Extension-Specific: Message Passing

Extension uses multi-layer message passing for dApp integration:

```
Webpage → CustomEvent('LayerzWalletExtension') → Content Script
  → chrome.runtime.sendMessage → Background Script → Popup
```

The `Provider` class (in `shared/class/provider.ts`) implements EIP-1193 for dApps.

## Code Style

**Prettier Configuration**:
- Single quotes
- Print width: 200 characters
- Trailing commas: ES5 style
- Arrow function parentheses: always

**Commit Messages**:
Follow [Conventional Commits](https://conventionalcommits.org/):
```
type(scope): description

Examples:
feat(wallet): add support for Taproot addresses
fix(ark): resolve VTXO renewal issue
refactor(hooks): optimize token discovery caching
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Adding a New Layer2

To add a new Layer2 network:

1. **Create wallet class** in `shared/class/wallets/`
   - Extend `AbstractWallet` or appropriate base class
   - Implement required interfaces (Lightning, AccountBased, Tokens)
   - Override `getBalance()`, `getTransactions()`, `createTransaction()`, etc.

2. **Add network definition**
   - Add constant in `shared/types/networks.ts`
   - Add metadata in `shared/models/all-network-infos.ts`

3. **Update React hooks**
   - Add case handlers in `useBalance`, `useTokenDiscovery`, `useTransactions`, etc.
   - Implement network-specific fetchers if needed

4. **Add UI assets**
   - Network logo in `mobile/assets/images/networks/` and `ext/src/images/networks/`
   - Update network switcher components

5. **Implement SDK adapter** (if needed)
   - For native modules: add to `mobile/` platform-specific code
   - For browser-based: add adapter in `ext/` or `shared/`
   - Expose via globalThis if needed for cross-context access

## Testing

**Unit tests**: Test individual functions and components in isolation. Located in:
- `ext/src/tests/unit-vi/`
- `mobile/src/tests/unit-vi/`
- `shared/tests/unit-vi/`

**Integration tests**: Test multi-component interactions. Located in:
- `ext/src/tests/integration/`
- `shared/tests/integration-vi/`

**E2E tests**:
- Extension: Playwright tests in `ext/tests/e2e/`
- Mobile: Maestro flows in `mobile/.maestro/`

## Important Notes

- **Platform Differences**: Always check for platform-specific code paths. Mobile and extension have different storage, navigation, and execution contexts.
- **Async Wallet Init**: Account-based wallets (ARK, Spark, Liquid, Stacks) require async SDK initialization. Always `await lazyInitWallet()`.
- **Serialization**: After modifying wallet state, serialize and save to storage. Extension background script may be killed at any time.
- **Type Safety**: Use TypeScript's discriminated unions and type guards. Runtime validation with `assert` after `lazyInitWallet()`.
- **SWR Caching**: Don't bypass SWR - it handles deduplication, revalidation, and error retry.
- **Master Seed Security**: masterSeed is cached in memory only, never persisted unencrypted except in SecureStorage (before password set).
