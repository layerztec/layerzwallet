/**
 * UTEXO Lightning Service Provider configuration for the RGB-over-LN path.
 *
 * Signet asset id comes from the live UTEXO faucet bot — the
 * rgb-sdk-rn-demo repo's value (`rgb:YKIE…`) does not exist on the running
 * LSP, so JIT channel opens never resolved. The faucet's `getnodeinfo`
 * returns the real one. Mainnet remains null pending UTEXO publishing the
 * production endpoints — the receive screen hides itself when null is
 * read (see receive-rgb-ln.tsx).
 */
export const RGB_LSP_BASE_URL: Record<'signet' | 'mainnet', string | null> = {
  signet: 'https://lsp-signet.utexo.com',
  mainnet: null,
};

/**
 * Signet LSP per-payment delivery ceilings, confirmed by UTEXO in
 * https://github.com/UTEXO-Protocol/rgb-sdk-rn/issues/51:
 *   - sats: one HTLC may carry at most 10% of the 100k-sat JIT channel
 *     (the node's `max_inbound_htlc_value_in_flight_percent` default);
 *   - asset: the LSP opens JIT channels with a fixed 50-asset-unit
 *     capacity regardless of the mapping amount.
 * Requests above either limit are accepted by the LSP but are
 * undeliverable — the sender's RGB leg then strands at the LSP (the
 * delivery worker makes a single attempt and marks the mapping
 * terminal). Enforce client-side until the LSP validates on accept and
 * retries failed deliveries (both planned per #51); once that ships,
 * re-check these numbers or drop the guard.
 */
export const RGB_LSP_MAX_RECEIVE_SATS = 10_000;
export const RGB_LSP_MAX_RECEIVE_ASSET_UNITS = 50;

/** Asset ids we want LN-receive surfaces for. UTST is the testnet stablecoin
 *  (USDT-equivalent) issued on utexo signet. */
export const RGB_LN_ASSETS: Record<'signet' | 'mainnet', { usdt: string | null }> = {
  signet: { usdt: 'rgb:2l_MeWlj-YS7qLKQ-RJVhrQk-G6i4jZ4-EJOMAYZ-mpHfoqI' },
  mainnet: { usdt: null },
};
