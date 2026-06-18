/**
 * UTEXO Lightning Service Provider configuration for the RGB-over-LN path.
 *
 * Signet values match the UTEXO-Protocol/rgb-sdk-rn-demo defaults. Mainnet
 * remains null pending UTEXO publishing the production endpoints — the
 * receive screen hides itself when null is read (see receive-rgb-ln.tsx).
 */
export const RGB_LSP_BASE_URL: Record<'signet' | 'mainnet', string | null> = {
  signet: 'https://lsp-signet.utexo.com',
  mainnet: null,
};

/** Asset ids we want LN-receive surfaces for. USDT is the launch token. */
export const RGB_LN_ASSETS: Record<'signet' | 'mainnet', { usdt: string | null }> = {
  signet: { usdt: 'rgb:YKIEjkhU-iqVFK0y-bfDUio6-bukqH7o-dxjctKB-5TuQ7aM' },
  mainnet: { usdt: null },
};
