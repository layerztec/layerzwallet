/**
 * UTEXO Lightning Service Provider configuration for the RGB-over-LN path.
 *
 * The values below are placeholders pending confirmation from UTEXO. Until
 * they are populated, any LN call routes through `createLsp()` will fail with
 * the SDK's own "LSP base URL not configured" error — surfacing the missing
 * config rather than silently sending to the wrong server.
 *
 * Sources we still need from upstream:
 *   - `signet` LSP base URL (probably https://lsp-signet.utexo.com or similar)
 *   - `signet` USDT asset id (RGB NIA asset issued on utexo signet)
 *   - mainnet equivalents (deferred per product call: mainnet behind flag)
 */
export const RGB_LSP_BASE_URL: Record<'signet' | 'mainnet', string | null> = {
  signet: null,
  mainnet: null,
};

/** Asset ids we want LN-receive surfaces for. USDT is the launch token. */
export const RGB_LN_ASSETS: Record<'signet' | 'mainnet', { usdt: string | null }> = {
  signet: { usdt: null },
  mainnet: { usdt: null },
};
