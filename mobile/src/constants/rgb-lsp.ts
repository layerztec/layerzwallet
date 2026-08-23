/**
 * UTEXO Lightning Service Provider configuration for the RGB-over-LN path.
 *
 * Two-asset model (rgb-sdk-rn beta.29+): the LSP serves ONE payout asset over
 * Lightning channels (LNUSDT) and accepts a separate on-chain "bridge" asset
 * (USDT) that it converts 1:1. See docs at rgb-sdk-rn `examples/lsp-two-assets`.
 * Mainnet stays null pending UTEXO publishing production endpoints — the
 * receive screen hides itself when the payout id is null (see receive-rgb-ln.tsx).
 */
export const RGB_LSP_BASE_URL: Record<'signet' | 'mainnet', string | null> = {
  signet: 'https://lsp-signet.utexo.com',
  mainnet: null,
};

/** One RGB asset the LSP deals in, with display metadata. */
export interface RgbLnAsset {
  assetId: string;
  ticker: string;
  /** Base-unit exponent: display value = baseUnits / 10^precision. */
  precision: number;
}

/**
 * The two signet assets, from the LSP's `get_info` (`supported_assets` lists
 * only the payout asset) and the two-asset demo config
 * (`screens/apay-linked-asset-signet/config.ts`):
 *   - payout (LNUSDT): what the LSP provisions in channels. `get_info`
 *     advertises it; the LSP cron auto-opens an LNUSDT channel on connect.
 *   - bridge (USDT): the canonical on-chain asset users hold (faucet / UTEXO
 *     Bridge). NOT in `get_info` — advertised per-address via discoverAddress.
 * Both precision 6. `null` on mainnet until UTEXO publishes production ids.
 */
export const RGB_LN_ASSETS: Record<'signet' | 'mainnet', { payout: RgbLnAsset | null; bridge: RgbLnAsset | null }> = {
  signet: {
    payout: { assetId: 'rgb:vDU5IB7L-ZJFyqM3-5KrG84e-L0Q4kzi-eg3y0nH-JzoBylw', ticker: 'LNUSDT', precision: 6 },
    bridge: { assetId: 'rgb:f~9F4X0C-TiLOTvy-pALF29V-2xJ2p0m-hP3_vpW-Alj4G5Y', ticker: 'USDT', precision: 6 },
  },
  mainnet: { payout: null, bridge: null },
};

/**
 * Fallback per-payment caps used ONLY when the live LSP `getInfo` limits are
 * unreachable. The authoritative values come from `get_info` at runtime
 * (`minPaymentSizeMsat`/`maxPaymentSizeMsat`, `minChannelAssetAmount`/
 * `maxChannelAssetAmount`), which the receive screen reads via
 * `wallet.getLspInfo()`. Signet currently publishes payment 3000–7500 sats and
 * a fixed 100 LNUSDT (100_000_000 base units at precision 6) channel.
 */
export const RGB_LSP_FALLBACK_MIN_SATS = 3_000;
export const RGB_LSP_FALLBACK_MAX_SATS = 7_500;
export const RGB_LSP_FALLBACK_MAX_ASSET_BASE_UNITS = 100_000_000;
