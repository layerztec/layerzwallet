# RGB Wallet Implementation

This document captures all the logic and context for the RGB wallet implementation in Layerz Wallet.

## Overview

RGB is a Bitcoin Layer 2 protocol for smart contracts and token issuance. The implementation follows the same architecture patterns as other wallet implementations in the codebase.

## Core Files

### Main Wallet Class
- **`shared/class/wallets/rgb-wallet.ts`** - Main RGBWallet class
- **`shared/class/wallets/rgb-types.ts`** - Custom type definitions (correcting SDK inaccuracies)

### Network Definitions
- **`shared/types/networks.ts`** - Network constants (`NETWORK_RGB`, `NETWORK_RGB_TESTNET`)
- **`shared/models/all-network-infos.ts`** - Network metadata (chainId, ticker, decimals)

### Platform Adapters
- **`mobile/src/modules/rgb-adapter.ts`** - React Native adapter using `rgb-sdk-rn`
- **`ext/src/modules/rgb-adapter.ts`** - Extension adapter using `rgb-sdk` (web)

### React Hooks
- **`shared/hooks/useBalance.ts`** - Balance fetching with RGB support
- **`shared/hooks/useTokenBalance.ts`** - Token balance fetching
- **`shared/hooks/useTokenDiscovery.ts`** - Token discovery
- **`shared/hooks/useTransactions.ts`** - Transaction history

### Mobile UI Components
- **`mobile/app/send/send-address-rgb.tsx`** - Address/invoice input screen
- **`mobile/app/send/send-amount-rgb.tsx`** - Amount and fee selection screen
- **`mobile/app/SendRgbToken.tsx`** - Dedicated token send screen (multi-step flow)
- **`mobile/app/ReceiveRgbToken.tsx`** - Generate and display RGB invoices
- **`mobile/app/send/_layout.tsx`** - Send flow context with `RgbPreparedTx` type

### Tests
- **`shared/tests/unit-vi/rgb-wallet.test.ts`** - Unit tests
- **`shared/tests/integration-vi/rgb.test.ts`** - Integration tests

---

## Network Configuration

```typescript
// Network constants
export const NETWORK_RGB = 'rgb' as const;
export const NETWORK_RGB_TESTNET = 'rgb_testnet' as const;

// Network metadata
[NETWORK_RGB]: {
  chainId: 20,
  ticker: 'BTC',
  decimals: 8,
  explorerUrl: '',
  rpcUrl: '',
  knowMoreUrl: 'https://rgb.tech',
  isEVM: false,
  sortIndex: 25,
},
[NETWORK_RGB_TESTNET]: {
  chainId: 21,
  ticker: 'tBTC',
  decimals: 8,
  explorerUrl: '',
  rpcUrl: '',
  knowMoreUrl: 'https://rgb.tech',
  isTestnet: true,
  isEVM: false,
  sortIndex: 85,
},

// RGB Node endpoints
mainnet: 'https://rgb-node.thunderstack.org/'
testnet: 'https://rgb-node.test.thunderstack.org/'
```

---

## RGBWallet Class

### Implements
- `InterfaceAccountBasedWallet` - Account-based (non-UTXO) wallet interface
- `InterfaceCanHaveTokens` - Token support interface

### Key Properties

```typescript
class RGBWallet implements InterfaceAccountBasedWallet, InterfaceCanHaveTokens {
  protected adapter: IRGBAdapter;
  private _sdk: RGBSDK | undefined;
  private _secret: string | undefined;
  private _network: RGBNetwork = 'mainnet';
  private _node: string = 'https://rgb-node.thunderstack.org/';
  public _wallet: InstanceType<RGBSDK['WalletManager']> | undefined;
  private _accountNumber: number = 0;
  private _tokenBalances: CachedTokenInfo[] = [];
  public _lastBalanceFetch: number = 0;
  private _preparingWallet: boolean = false;
}
```

### HD Key Derivation

Uses BIP86 (Taproot) derivation with custom coin types for RGB:

```typescript
const DERIVATION_PURPOSE = 86;
const COIN_RGB_MAINNET = 827166;
const COIN_RGB_TESTNET = 827167;
const COIN_BITCOIN_MAINNET = 0;
const COIN_BITCOIN_TESTNET = 1;

// Derivation paths:
// Vanilla (BTC): m/86'/{coinTypeBtc}'/{accountNumber}'
// Colored (RGB): m/86'/{coinTypeRgb}'/{accountNumber}'
```

Key derivation produces:
- `mnemonic` - Original seed phrase
- `xpub` / `xpriv` - Root keys
- `account_xpub_vanilla` - BTC account xpub
- `account_xpub_colored` - RGB account xpub
- `master_fingerprint` - Hash160 of root pubkey (first 4 bytes)

### Initialization

```typescript
async init() {
  this._sdk = await this.adapter.initialize();
  const restoredKeys = await this._sdk.deriveKeysFromMnemonic(this._network, this._secret);
  this._wallet = new this._sdk.WalletManager({
    xpub_van: restoredKeys.account_xpub_vanilla,
    xpub_col: restoredKeys.account_xpub_colored,
    master_fingerprint: restoredKeys.master_fingerprint,
    mnemonic: restoredKeys.mnemonic,
    network: this._network,
    rgb_node_endpoint: this._node,
  });
  await this._wallet.registerWallet();
  setTimeout(() => this.prepareWallet(), 1000); // Background UTXO preparation
}
```

---

## Core Methods

### Balance Methods

```typescript
// Get BTC balance (vanilla + colored)
async getBalance(): Promise<number> {
  const balance = await this._wallet.getBtcBalance();
  return balance.vanilla.spendable + balance.colored.spendable;
}

// InterfaceAccountBasedWallet - includes token allocation balance
async getOffchainBalance(): Promise<number> {
  const balance = await this._wallet.getBtcBalance();
  await this.fetchTokenBalances();
  return balance.vanilla.spendable + balance.colored.spendable;
}

// Get receive address (taproot format)
async getOffchainReceiveAddress(): Promise<string> {
  return await this._wallet.getAddress();
}
```

### BTC Send Flow (Two-Step)

```typescript
// Step 1: Sign transaction (don't broadcast)
async sendBtcPrepare(address: string, amount: number, feeRate: number): Promise<string> {
  const psbt = await this._wallet.sendBtcBegin({ address, amount, fee_rate: feeRate });
  return await this._wallet.signPsbt(psbt);
}

// Step 2: Broadcast signed transaction
async sendBtcBroadcast(signedPsbt: string): Promise<string> {
  const result = await this.completeBtcSend(signedPsbt);
  return result.txid;
}

// Convenience method (prepare + broadcast)
async pay(address: string, amount: number, feeRate?: number): Promise<string>
```

### Token Send Flow (Two-Step)

```typescript
// Step 1: Sign token transfer
async sendTokenPrepare(
  tokenId: string,
  amount: bigint,
  invoice: string,
  feeRate: number
): Promise<{ signedPsbt: string; txid: string }> {
  const decodedInvoice = await this.decodeInvoice(invoice);

  const sendParams = {
    invoice,
    min_confirmations: 1,
    fee_rate: feeRate,
  };

  // Only pass asset_id if invoice is wildcard (no asset specified)
  if (!decodedInvoice.asset_id) {
    sendParams.asset_id = tokenId;
  }

  // Only pass amount if invoice doesn't specify one
  if (!decodedInvoice.assignment?.amount) {
    sendParams.amount = Number(amount);
  }

  const psbt = await this._wallet.sendBegin(sendParams);
  const signedPsbt = await this._wallet.signPsbt(psbt);
  return { signedPsbt, txid: '' };
}

// Step 2: Broadcast token transfer
async sendTokenBroadcast(signedPsbt: string): Promise<string> {
  const result = await this.completeTokenSend(signedPsbt);
  return result.txid;
}

// Convenience method
async transferToken(tokenId: string, amount: bigint, invoice: string, feeRateStr?: string): Promise<string>
```

### Invoice Generation

```typescript
// Generate wildcard invoice (any token)
async getWitnessReceiveInvoice(amount: number): Promise<string> {
  const invoiceRequest = { amount };
  const receiveData = await this.blindReceive(invoiceRequest);
  return receiveData.invoice;
}

// Generate blind invoice with UTXO management
async createBlindInvoice(
  amount: number,
  assetId?: string,
  feeRate?: number
): Promise<{ invoice: string; expirationTimestamp: number }> {
  // Ensure UTXOs are available
  await this.ensureColorableUtxos(feeRate);

  const invoiceRequest = { amount };
  if (assetId) invoiceRequest.asset_id = assetId;

  try {
    const receiveData = await this.blindReceive(invoiceRequest);
    return {
      invoice: receiveData.invoice,
      expirationTimestamp: receiveData.expiration_timestamp ?? Math.floor(Date.now() / 1000) + 86400,
    };
  } catch (error) {
    // Retry with UTXO creation on allocation errors
    if (errorMessage.includes('InsufficientAllocationSlots')) {
      await this.createColorableUtxos(feeRate);
      const receiveData = await this.blindReceive(invoiceRequest);
      return { ... };
    }
    throw error;
  }
}
```

### UTXO Management

RGB requires "colorable" UTXOs for token operations:

```typescript
// Check and create UTXOs if needed (called after init)
async prepareWallet(): Promise<void> {
  // Only run in low-fee environment (medium < 3 sats/vB)
  const fees = await BlueElectrum.estimateFees();
  if (fees.medium > 3) return;

  const unspents = await this.listUnspents();
  const availableColorable = unspents.filter(u =>
    u.utxo.colorable &&
    !u.pending_blinded &&
    (!u.rgb_allocations || u.rgb_allocations.length === 0)
  );

  // Create if 1 or fewer available
  if (availableColorable.length <= 1) {
    await this._wallet.createUtxos({
      up_to: true,   // Create as many as affordable
      num: 5,        // Target 5 UTXOs
      size: 1000,    // 1000 sats each
      fee_rate: fees.slow,
    });
  }
}

// Ensure at least one colorable UTXO exists
async ensureColorableUtxos(feeRate?: number): Promise<void>

// Create colorable UTXOs
async createColorableUtxos(feeRate?: number): Promise<void>

// Get count of available colorable UTXOs
async getAvailableColorableUtxoCount(): Promise<number>
```

### Token Balance Discovery

```typescript
async fetchTokenBalances(): Promise<void> {
  const assets = await this.listAssets();
  this._tokenBalances = [];
  const chainId = this._network === 'mainnet' ? 20 : 21;

  for (const key of ['nia', 'uda', 'cfa']) {
    if (!assets[key]) continue;
    for (const asset of assets[key]) {
      this._tokenBalances.push({
        id: asset.asset_id,
        name: asset.name,
        symbol: asset.ticker,
        decimals: asset.precision,
        chainId,
        balance: String(asset.balance.settled),
      });
    }
  }
}

getTokenBalances(): CachedTokenInfo[] {
  return this._tokenBalances;
}
```

### Transaction History

```typescript
async getCommonTransactions(): Promise<CommonTransaction[]> {
  const txMap = new Map<string, CommonTransaction>();

  // 1. Fetch BTC on-chain transactions
  const btcTransactions = await this._wallet.listTransactions();

  // transaction_type: 0=RGB_SEND, 1=DRAIN, 2=CREATE_UTXOS, 3=USER
  for (const tx of btcTransactions) {
    let direction: 'send' | 'receive' | 'swap';
    let amount = 0;

    switch (tx.transaction_type) {
      case 0: // RGB_SEND - amount is 0 (shown in tokenTransfers)
        direction = 'send';
        break;
      case 2: // CREATE_UTXOS - internal, net negative
        direction = 'swap';
        amount = -tx.fee;
        break;
      default: // USER - regular transaction
        if (tx.received > 0 && tx.sent > 0) {
          direction = 'swap';
          amount = tx.received - tx.sent;
        } else if (tx.received > 0) {
          direction = 'receive';
          amount = tx.received;
        } else {
          direction = 'send';
          amount = tx.sent;
        }
    }

    txMap.set(tx.txid, { ... });
  }

  // 2. Fetch RGB token transfers for each NIA asset
  const assets = await this.listAssets();

  for (const assetId of niaAssetIds) {
    const transfers = await this._wallet.listTransfers(assetId);

    // kind: 0=issue, 1=receive, 2=receive_blind, 3=send
    // status: 0=WAITING_COUNTERPARTY, 1=WAITING_CONFIRMATIONS, 2=SETTLED, 3=FAILED
    for (const transfer of transfers) {
      const direction = transfer.kind === 3 ? 'send' : 'receive';

      // Merge with BTC tx or create standalone entry
      const existingTx = txMap.get(transfer.txid);
      if (existingTx) {
        existingTx.tokenTransfers.push(tokenTransfer);
        // RGB pending status takes precedence
        if (rgbStatus === 'pending') existingTx.status = 'pending';
      } else {
        txMap.set(txid, { ... });
      }
    }
  }

  // Sort by timestamp, newest first
  return Array.from(txMap.values()).sort((a, b) => b.timestamp - a.timestamp);
}
```

### Address Validation

```typescript
// Accept taproot addresses (bc1p/tb1p) and RGB invoices (rgb:)
static isAddressValid(address: string): boolean {
  return address.startsWith('bc1p') || address.startsWith('tb1p') || address.startsWith('rgb:');
}

static isRgbInvoice(str: string): boolean {
  return str.startsWith('rgb:');
}

static isTaprootAddress(str: string): boolean {
  return str.startsWith('bc1p') || str.startsWith('tb1p');
}
```

### Invoice Decoding

```typescript
async decodeRgbInvoice(invoice: string): Promise<RgbDecodedInvoice> {
  return await this.decodeInvoice(invoice);
}
```

### Fee Estimation

```typescript
async getFeeEstimates(): Promise<{ slow: number; medium: number; fast: number }> {
  if (!BlueElectrum.mainConnected) {
    await BlueElectrum.connectMain();
  }
  return await BlueElectrum.estimateFees();
}
```

---

## Custom Types (rgb-types.ts)

The RGB SDK TypeScript definitions have inaccuracies. These types correct them:

```typescript
// Asset balance - SDK declares BtcBalance but runtime returns flat structure
interface AssetBalanceCustom {
  settled: number;
  future: number;
  spendable: number;
  offchain_outbound: number;
  offchain_inbound: number;
}

// Decoded invoice - SDK declares SendAssetBeginRequestModel but runtime returns this
interface DecodeRgbInvoiceResponseCustom {
  recipient_id: string;
  asset_schema: string | null;
  asset_id: string | null;                    // null for wildcard invoices
  assignment: { amount: number } | null;      // null if no amount specified
  assignment_name: string;
  network: number;
  expiration_timestamp: number;
  transport_endpoints: string[];
}

// UTXO - SDK missing pending_blinded property
interface UnspentCustom {
  utxo: {
    outpoint: { txid: string; vout: number };
    btc_amount: number;
    colorable: boolean;
  };
  rgb_allocations: Array<{ asset_id: string; amount: number; settled: boolean }>;
  pending_blinded?: boolean;
}

// Send result - SDK declares string but runtime returns object
interface SendResultCustom {
  txid: string;
  batch_transfer_idx: number;
}

// Asset with correct balance type
interface AssetNIACustom {
  asset_id: string;
  name: string;
  ticker: string;
  precision: number;
  balance: AssetBalanceCustom;
  // ... optional fields
}

// List assets - SDK declares undefined but runtime returns null
interface ListAssetsResponseCustom {
  nia: AssetNIACustom[] | null;
  uda: AssetNIACustom[] | null;
  cfa: AssetNIACustom[] | null;
}

// Invoice request - SDK declares asset_id required but it's optional for wildcards
interface InvoiceRequestCustom {
  amount: number;
  asset_id?: string;
}
```

---

## Asset Types Supported

- **NIA** (Non-Issuable Assets) - Regular fungible tokens
- **UDA** (Unique Digital Assets) - NFT-like assets
- **CFA** (Collectible Fungible Assets) - Limited edition tokens

All types tracked with: balance, name, ticker, precision (decimals)

---

## Platform Adapters

### Mobile (React Native)

```typescript
// mobile/src/modules/rgb-adapter.ts
import * as sdk from 'rgb-sdk-rn';

class RGBAdapter implements IRGBAdapter {
  async initialize(): Promise<RGBSDK> {
    return sdk as unknown as RGBSDK;
  }
}

globalThis.rgbAdapter = new RGBAdapter();
```

### Extension (Web)

```typescript
// ext/src/modules/rgb-adapter.ts
class RGBAdapter implements IRGBAdapter {
  private sdk: RGBSDK | undefined;

  async initialize(): Promise<RGBSDK> {
    if (this.sdk) return this.sdk;
    this.sdk = await import('rgb-sdk');
    return this.sdk;
  }
}

globalThis.rgbAdapter = new RGBAdapter();
```

---

## Send Flow Context

```typescript
// RGB-specific data types
interface RgbPreparedTx {
  signedPsbt: string;     // Signed PSBT ready for broadcast
  feeRate: number;        // Fee rate used (sats/vB)
  amount: number;         // Amount in base units
  tokenId?: string;       // For token sends
  invoice?: string;       // For token sends
}

// In SendFlowContextData
rgbDecodedInvoice: RgbDecodedInvoice | undefined;
rgbPreparedTx: RgbPreparedTx | undefined;
```

---

## UI Flows

### Send BTC (Taproot Address)

1. Enter taproot address (bc1p/tb1p) on `send-address-rgb.tsx`
2. Enter amount and select fee on `send-amount-rgb.tsx`
3. Call `sendBtcPrepare()` to create signed PSBT
4. Store in `rgbPreparedTx` context
5. Confirm screen calls `sendBtcBroadcast()`

### Send Token (RGB Invoice)

1. Enter RGB invoice (rgb:...) on `send-address-rgb.tsx`
2. Invoice is validated via `decodeRgbInvoice()`
3. If wildcard invoice, show token picker
4. Enter amount (or use pre-filled from invoice) on `send-amount-rgb.tsx`
5. Call `sendTokenPrepare()` to create signed PSBT
6. Store in `rgbPreparedTx` context
7. Confirm screen calls `sendTokenBroadcast()`

### Alternative Token Send (`SendRgbToken.tsx`)

Multi-step flow for dedicated token sending:
1. `Init` - Enter invoice and amount
2. `Loading` - Validate inputs
3. `Signed` - Show transaction summary
4. `Broadcasting` - Sending transaction
5. `Success` - Show success screen

### Receive Tokens (`ReceiveRgbToken.tsx`)

1. Enter amount (in base units)
2. Click "Generate Invoice"
3. Calls `getWitnessReceiveInvoice(amount)`
4. Display QR code with invoice
5. Copy/share functionality

---

## React Hooks Integration

### useBalance
```typescript
if (network === NETWORK_RGB || network === NETWORK_RGB_TESTNET) {
  const wallet = await executor.lazyInitWallet(network, accountNumber);
  return (wallet as RGBWallet).getOffchainBalance();
}
// Refresh interval: 30 seconds
```

### useTokenDiscovery
```typescript
if (network === NETWORK_RGB || network === NETWORK_RGB_TESTNET) {
  const wallet = await executor.lazyInitWallet(network, accountNumber);
  await (wallet as RGBWallet).fetchTokenBalances();
  return (wallet as RGBWallet).getTokenBalances();
}
// Auto-refresh enabled
```

### useTokenBalance
```typescript
if (network === NETWORK_RGB || network === NETWORK_RGB_TESTNET) {
  const wallet = await executor.lazyInitWallet(network, accountNumber);
  const tokens = (wallet as RGBWallet).getTokenBalances();
  const token = tokens.find(t => t.id === tokenId);
  return token?.balance ?? '0';
}
```

### useTransactions
```typescript
if (network === NETWORK_RGB || network === NETWORK_RGB_TESTNET) {
  const wallet = await executor.lazyInitWallet(network, accountNumber);
  return (wallet as RGBWallet).getCommonTransactions();
}
// Refresh interval: 30 seconds
```

---

## Wallet Lazy Initialization

```typescript
// In wallet-utils.ts
if (network === NETWORK_RGB || network === NETWORK_RGB_TESTNET) {
  const RGBWallet = (await import('../class/wallets/rgb-wallet')).RGBWallet;
  const rgbNetwork = network === NETWORK_RGB ? 'mainnet' : 'testnet';
  const wallet = new RGBWallet(rgbNetwork);
  wallet.setSecret(masterSeed);
  wallet.setAccountNumber(accountNumber);
  await wallet.init();
  return wallet;
}
```

---

## NPM Dependencies

```json
// Extension (web)
"rgb-sdk": "1.2.7"

// Mobile
"rgb-sdk": "1.2.7"       // Web fallback
"rgb-sdk-rn": "1.0.1"    // React Native native
```

---

## Testing

### Unit Tests (rgb-wallet.test.ts)

- Key derivation for different accounts
- Master fingerprint verification
- Mainnet vs testnet derivation differences
- Address validation (taproot, invoices)
- Transaction mapping and merging logic

### Integration Tests (rgb.test.ts)

- RGB adapter initialization and caching
- Balance fetching
- Transaction history with proper structure
- Token balance discovery

---

## Key Implementation Notes

1. **Two-Step Transaction Flow**: Always prepare (sign) first, then broadcast separately. This allows UI to show confirmation before sending.

2. **UTXO Management**: RGB requires "colorable" UTXOs. The wallet automatically creates them in low-fee environments.

3. **Invoice Types**:
   - Wildcard (no asset_id): Can receive any token
   - Asset-specific: Only receives specified token
   - Amount-locked: Pre-filled amount from invoice

4. **Transaction Merging**: BTC transactions and RGB transfers with matching txids are merged into single entries.

5. **Status Priority**: RGB pending status takes precedence over BTC confirmed (transfer isn't complete until RGB state settles).

6. **SDK Type Corrections**: Many SDK types are inaccurate - use custom types from `rgb-types.ts`.

7. **Server Limitation**: Custom account derivation (`customDeriveKeysFromMnemonic`) throws 400 on server registration - must use SDK's built-in derivation.
