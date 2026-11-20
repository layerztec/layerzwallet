/**
 * RGB testnet = public Bitcoin signet, the chain the UTEXO Mint sandbox
 * (`sandbox.gateway.mint.utexo.com`) mints to. Confirmed by UTEXO 2026-11-20:
 * the SDK network `utexo` is their private dev chain and must not be used.
 */
export const RGB_TESTNET_ENGINE_NETWORK = 'signet';

/**
 * The SDK default for signet (`staging.rgb-proxy.utexo.com`) answers 404;
 * the sandbox proxy is the one that serves protocol 1.0 for this environment.
 */
export const RGB_TESTNET_PROXY = 'rpcs://sandbox.rgb-proxy.utexo.com/json-rpc';

/** Esplora for engines that cannot speak Electrum (the web engine). */
export const RGB_TESTNET_ESPLORA = 'https://mempool.space/signet/api';

/**
 * USDT on Bitcoin is a BFA asset: validating a consignment means checking the
 * USDT0 deposit behind every mint on the Arbitrum bridge, so the engine needs
 * an Arbitrum RPC, keyed by EVM chain id.
 */
export const RGB_EVM_RPC_URLS: Readonly<Record<string, string>> = { '42161': 'https://arb1.arbitrum.io/rpc' };
