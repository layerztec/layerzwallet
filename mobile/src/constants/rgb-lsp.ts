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

/** Asset ids we want LN-receive surfaces for. UTST is the testnet stablecoin
 *  (USDT-equivalent) issued on utexo signet. */
export const RGB_LN_ASSETS: Record<'signet' | 'mainnet', { usdt: string | null }> = {
  signet: { usdt: 'rgb:2l_MeWlj-YS7qLKQ-RJVhrQk-G6i4jZ4-EJOMAYZ-mpHfoqI' },
  mainnet: { usdt: null },
};
