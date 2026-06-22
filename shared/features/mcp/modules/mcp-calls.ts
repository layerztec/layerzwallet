/**
 * Wallet MCP surface — add or change tools / call behaviour here.
 * No HTTP, tunnel, or session lifecycle (that stays in `mcp.ts`).
 *
 * Platform-specific bits (toast notifications, analytics, storage, wallet
 * runtime) are injected via `McpCallDeps`; this file imports nothing from
 * `react-native`, AsyncStorage, mobile-only modules, etc.
 */

import BigNumber from 'bignumber.js';
import * as bolt11 from 'bolt11';
import { isValidSparkAddress } from '@buildonspark/spark-sdk';
import * as z from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import * as BlueElectrum from '../../../blue_modules/BlueElectrum';
import { EvmWallet } from '../../../class/evm-wallet';
import { BreezWallet, LBTC_ASSET_IDS } from '../../../class/wallets/breez-wallet';
import { SparkWallet, SPARK_STATIC_DEPOSIT_CONFIRMATIONS } from '../../../class/wallets/spark-wallet';
import { walletCanHaveNfts } from '../../../class/wallets/interface-can-have-nfts';
import { walletCanHaveTokens } from '../../../class/wallets/interface-can-have-tokens';
import { walletIsAccountBased } from '../../../class/wallets/interface-account-based-wallet';
import { walletSupportsLightning } from '../../../class/wallets/interface-lightning-wallet';
import { walletCanSendQuote } from '../../../class/wallets/interface-send-quotable';
import { MCP_BALANCE_ACCOUNT_NUMBER } from '../../../hooks/AccountNumberContext';
import { exchangeRateFetcher } from '../../../hooks/useExchangeRate';
import { balanceFetcher } from '../../../hooks/useBalance';
import { tokenBalanceFetcher } from '../../../hooks/useTokenBalance';
import { getTransferServiceManager, setFlashnetAccountNumber, useTransferService } from '../../../hooks/useTransferService';
import { getAssetInfo } from '../../../models/asset-info';
import { getDecimalsByNetwork, getIsEVM, getIsTestnet, getTickerByNetwork } from '../../../models/network-getters';
import { getTokenInfo, getTokenList } from '../../../models/token-list';
import { validateAddress, type TSupportedLazyInitWalletNetworks } from '../../../modules/wallet-utils';
import { claimLayerzLightningAddressUsername, LAYERZ_ME_DOMAIN, lookupLayerzLightningAddress } from '../../../modules/layerz-lightning-address';
import { AssetId } from '../../../types/asset';
import type { SendQuote } from '../../../types/send-quote';
import {
  getAvailableNetworks,
  NETWORK_ARK,
  NETWORK_ARK_MUTINYNET,
  NETWORK_BITCOIN,
  NETWORK_LIGHTNING,
  NETWORK_LIGHTNING_TESTNET,
  NETWORK_LIQUID,
  NETWORK_SPARK,
  NETWORK_STACKS,
  NETWORK_USDT,
  type Networks,
} from '../../../types/networks';
import { EXECUTION_CLAIM, EXECUTION_INSTANT, type NativeClaimExecution } from '../../../types/transfer';

import { pushMcpActivityLog } from './mcp-activity-log';
import { MCP_LIGHTNING_PAY_MAX_FEE_PERCENT } from './mcp-constants';
import type { McpCallDeps } from './mcp-deps';
import { MCP_BASE_UNITS_GUIDANCE, mcpBaseUnitsToHumanReadable } from './mcp-instructions';

function mcpCallLog(line: string): void {
  console.log('[mcp-call] ' + line);
}

function bolt11Preview(bolt: string, max = 28): string {
  const t = bolt.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function mcpBalanceFields(baseUnits: string, decimals: number): { balance_base_units: string; balance_human_readable: string | null } {
  return { balance_base_units: baseUnits, balance_human_readable: mcpBaseUnitsToHumanReadable(baseUnits, decimals) };
}

/** Networks whose lazy-init wallet can pay BOLT11 Lightning invoices. */
const MCP_LIGHTNING_PAY_NETWORKS = [NETWORK_SPARK, NETWORK_LIQUID] as const;

const mcpLightningPayNetworkSchema = z.enum(MCP_LIGHTNING_PAY_NETWORKS);

/** Mainnet-style networks exposed to MCP (no testnets, Lightning, USDT, or Ark). */
function mcpListableNetworks(): Networks[] {
  return getAvailableNetworks().filter((n) => !getIsTestnet(n) && n !== NETWORK_LIGHTNING && n !== NETWORK_LIGHTNING_TESTNET && n !== NETWORK_USDT && n !== NETWORK_ARK && n !== NETWORK_ARK_MUTINYNET);
}

/** Positive integer string for token amounts in smallest units (no precision loss). */
const mcpPositiveBaseUnitsString = z.string().regex(/^[1-9]\d*$/, 'Must be a positive integer string in smallest token units (no decimals), e.g. "1000000".');

/**
 * Networks whose wallets self-discover held tokens via the SDK (`InterfaceCanHaveTokens`) and
 * transfer through `wallet.transferToken(...)`. Also the discovery branch of `list_tokens`.
 * EVM token transfer takes a separate code path (see {@link MCP_EVM_TOKEN_TRANSFER_NETWORKS}),
 * so this stays narrow. Pairs with the read-only superset {@link MCP_TOKEN_READ_NETWORKS}.
 */
const MCP_TOKEN_WRITE_NETWORKS = [NETWORK_SPARK, NETWORK_STACKS] as const;

/**
 * Networks `list_tokens` can read. Superset of {@link MCP_TOKEN_WRITE_NETWORKS}: also includes every
 * mainnet network that ships a curated token list (EVM L2s like Rootstock/Citrea, plus Liquid),
 * for which there is no on-chain discovery — we enumerate the list and query each balance.
 * Derived from the bundled token list so new curated networks are picked up automatically.
 */
const MCP_TOKEN_READ_NETWORKS: Networks[] = (() => {
  const set = new Set<Networks>([...MCP_TOKEN_WRITE_NETWORKS]);
  for (const n of mcpListableNetworks()) {
    if (getTokenList(n).length > 0) set.add(n);
  }
  return [...set];
})();
const mcpTokenReadNetworkSchema = z.enum(MCP_TOKEN_READ_NETWORKS as [string, ...string[]]);

/**
 * EVM networks `transfer_token` can write to: the EVM members of the curated read set. EVM wallets
 * don't implement `InterfaceCanHaveTokens`; they transfer via the same low-level path as the UI
 * token-send screen (`createTokenTransferTransaction → prepareTransaction → signTransaction →
 * broadcastTransaction`). Derived so new curated EVM chains are picked up automatically.
 */
const MCP_EVM_TOKEN_TRANSFER_NETWORKS: Networks[] = MCP_TOKEN_READ_NETWORKS.filter((n) => getIsEVM(n));

/**
 * Liquid networks `transfer_token` can write to. Liquid (Breez) wallets don't implement
 * `InterfaceCanHaveTokens` either; they transfer via the same Breez SDK path as the UI token-send
 * screen (`prepareSendPayment` with an asset amount → `sendPayment`). Derived from the read set so
 * it only appears when Liquid is a listable mainnet (today: just `liquid`).
 */
const MCP_LIQUID_TOKEN_TRANSFER_NETWORKS: Networks[] = MCP_TOKEN_READ_NETWORKS.filter((n) => n === NETWORK_LIQUID);

/**
 * All networks `transfer_token` accepts: SDK token-interface wallets (Spark/Stacks), EVM L2s, and
 * Liquid. The handler routes EVM networks through the UI EVM token-send path, Liquid through the
 * Breez SDK send path, and the rest through `wallet.transferToken(...)`.
 */
const MCP_TOKEN_TRANSFER_NETWORKS: Networks[] = [...MCP_TOKEN_WRITE_NETWORKS, ...MCP_EVM_TOKEN_TRANSFER_NETWORKS, ...MCP_LIQUID_TOKEN_TRANSFER_NETWORKS];
// Cast to a non-empty tuple of `Networks` (not `string`) so the schema's inferred type — and thus
// the handler's `network` param — stays `Networks`, avoiding a downstream `as Networks` cast.
const mcpTokenTransferNetworkSchema = z.enum(MCP_TOKEN_TRANSFER_NETWORKS as [Networks, ...Networks[]]);

/**
 * Networks `transfer_native` can send the chain's native coin on. Generic across networks —
 * extended per-network as branches are added to the handler. Wired up today:
 *  - EVM mainnets (RBTC on Rootstock, cBTC on Citrea, …): no curated token list needed, reuse the
 *    UI coin-send path (`createPaymentTransaction → prepareTransaction → signTransaction →
 *    broadcastTransaction`).
 *  - Liquid (L-BTC): Breez wallet — L-BTC is the default Liquid *asset*, sent via `prepareSendPayment`
 *    (`{ type: 'asset', toAsset: <L-BTC asset id>, receiverAmount }`) → `sendPayment`, exactly like
 *    the UI native send screen and the transfer_token Liquid branch.
 *  - Spark (BTC) and Stacks (sBTC, its main balance): single-address `InterfaceAccountBasedWallet`
 *    wallets, sent via `pay(address, amountSats)` — the same call the UI SendAccountBased screen uses.
 * EVM set is derived so new EVM mainnets are picked up automatically.
 */
const MCP_NATIVE_TRANSFER_NETWORKS: Networks[] = [...mcpListableNetworks().filter((n) => getIsEVM(n)), NETWORK_LIQUID, NETWORK_SPARK, NETWORK_STACKS];
const mcpNativeTransferNetworkSchema = z.enum(MCP_NATIVE_TRANSFER_NETWORKS as [Networks, ...Networks[]]);

/** Max EVM fee "speed up" multiplier exposed to MCP. */
const MCP_EVM_FEE_MULTIPLIER_MAX = 5;

/**
 * Reject a Bitcoin send quote whose fee would exceed this percent of the send amount. There is no
 * `fee_rate` upper bound — the agent owns the rate it picks — so this is the one guardrail against a
 * fat-fingered rate (or a pathological UTXO set) burning the wallet. It also rejects dust-sized sends
 * where the fee naturally dominates, which is intended (on-chain BTC is not for tiny amounts).
 */
const MCP_BTC_MAX_FEE_PERCENT_OF_AMOUNT = 30;

/** Networks supported by list_nfts / transfer_nft. */
const MCP_NFT_NETWORKS = [NETWORK_SPARK, NETWORK_STACKS] as const;
const mcpNftNetworkSchema = z.enum(MCP_NFT_NETWORKS);

/**
 * AssetIds the MCP swap tools accept. Today: only BTC↔USDB on Spark (Flashnet AMM).
 * Adding more pairs is purely additive: extend this list and the routing falls through
 * to whatever provider TransferServiceManager picks.
 */
const MCP_SWAP_ASSET_IDS = ['native:spark', 'token:spark:usdb'] as const satisfies readonly AssetId[];
const mcpSwapAssetSchema = z.enum(MCP_SWAP_ASSET_IDS);

function normalizeBolt11Invoice(raw: string): string {
  const t = raw.trim();
  const lower = t.toLowerCase();
  if (lower.startsWith('lightning:')) {
    return t.slice('lightning:'.length).trim();
  }
  return t;
}

/**
 * Always pushes to the in-memory activity log (UI subscribes via `subscribeMcpActivityLog`).
 * Optionally surfaces a native toast via `deps.showSuccessToast` (platform-specific chrome).
 */
function showMcpSuccess(deps: McpCallDeps, actionSummary: string, detail?: string): void {
  pushMcpActivityLog(actionSummary);
  deps.showSuccessToast?.(actionSummary, detail);
}

function trackMcpCall(deps: McpCallDeps, toolName: string): void {
  deps.trackToolCall?.(toolName);
}

export function registerWalletMcpCalls(mcp: McpServer, deps: McpCallDeps): void {
  const { storage, backgroundCaller } = deps;

  /**
   * In-memory staging for native Bitcoin send quotes: `quote_id` → the prepared `SendQuote` (carries the
   * unsigned PSBT in `_prepared`, and echoes the request — address/amount/feeRate — plus the fee, so
   * nothing else needs storing). Closure-scoped (not module-level) so each registered server gets its own
   * store — test-isolated, no cross-session leak. Single-use: removed only on a *successful*
   * `execute_bitcoin_send`. No TTL — a PSBT is valid until its inputs are spent; a stale quote just fails
   * to broadcast and the agent re-quotes.
   */
  const btcSendQuotes = new Map<string, SendQuote>();

  mcp.registerTool(
    'list_networks',
    {
      title: 'List available Bitcoin networks',
      description: 'Returns mainnet networks supported by this wallet',
    },
    async () => {
      mcpCallLog('list_networks: start');
      trackMcpCall(deps, 'list_networks');
      const networks = mcpListableNetworks();
      mcpCallLog(`list_networks: ok - ${networks.length} network(s): ${networks.join(', ')}`);
      showMcpSuccess(deps, 'Listed networks', `${networks.length} network(s)`);
      return {
        content: [{ type: 'text', text: JSON.stringify({ networks }, null, 2) }],
      };
    }
  );

  mcp.registerTool(
    'get_network_balance',
    {
      title: 'Get balance for a network',
      description:
        'Returns `balance_base_units` (smallest units), `balance_human_readable` (decimal string for showing the user), `ticker`, and `decimals`. Use the `network` id exactly as returned by list_networks.\n\n' +
        MCP_BASE_UNITS_GUIDANCE +
        '\n\nFor Spark BTC swaps (`get_swap_quote` with `send_asset` `native:spark`), pass this `balance_base_units` **as-is** into `send_amount_base_units` when swapping the full balance (or a smaller integer ≤ balance) — do not scale it.',
      inputSchema: {
        network: z.string().min(1).describe('Network id from list_networks, e.g. bitcoin, spark, liquid.'),
      },
    },
    async ({ network: networkName }) => {
      const trimmed = networkName.trim();
      mcpCallLog(`get_network_balance: start - network=${trimmed}`);
      trackMcpCall(deps, 'get_network_balance');
      const allowed = mcpListableNetworks();
      const network = allowed.find((n) => n === trimmed);

      if (!network) {
        mcpCallLog(`get_network_balance: error - unknown network "${trimmed}"`);
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: `Unknown network "${networkName}". Use a string from list_networks.`,
                  networks: allowed,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      try {
        const balance = await balanceFetcher({
          cacheKey: 'balanceFetcher',
          accountNumber: MCP_BALANCE_ACCOUNT_NUMBER,
          network,
          backgroundCaller,
        });
        const ticker = getTickerByNetwork(network);
        const decimals = getDecimalsByNetwork(network);
        mcpCallLog(`get_network_balance: ok - ${network} (${ticker}), balance ${balance != null ? 'fetched' : 'null'}`);
        showMcpSuccess(deps, 'Fetched balance for ' + network);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  network,
                  balance_base_units: balance ?? null,
                  balance_human_readable: balance != null ? mcpBaseUnitsToHumanReadable(balance, decimals) : null,
                  ticker,
                  decimals,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        mcpCallLog(`get_network_balance: error - exception: ${message}`);
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        };
      }
    }
  );

  mcp.registerTool(
    'get_receive_address',
    {
      title: 'Get receive address for a network',
      description:
        "Returns the wallet's receive address for `network` (use the id exactly as returned by list_networks). Use this when the user wants to receive funds. " +
        'Address format varies per network — Bitcoin: bc1…; EVM chains (rootstock, citrea): 0x… (the same address works across all EVM chains); Liquid: lq1…/VJL…; Spark: spark1…; Stacks: SP… principal. ' +
        'Pass the returned address back to senders verbatim.',
      inputSchema: {
        network: z.string().min(1).describe('Network id from list_networks, e.g. bitcoin, rootstock, liquid, spark, stacks.'),
      },
    },
    async ({ network: networkName }) => {
      const trimmed = networkName.trim();
      mcpCallLog(`get_receive_address: start - ${trimmed}`);
      trackMcpCall(deps, 'get_receive_address');
      const allowed = mcpListableNetworks();
      const network = allowed.find((n) => n === trimmed);

      if (!network) {
        mcpCallLog(`get_receive_address: error - unknown network "${trimmed}"`);
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: `Unknown network "${networkName}". Use a string from list_networks.`,
                  networks: allowed,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      try {
        const address = await backgroundCaller.getAddress(network, MCP_BALANCE_ACCOUNT_NUMBER);
        const ticker = getTickerByNetwork(network);
        mcpCallLog(`get_receive_address: ok - ${network} (${ticker}), ${address.slice(0, 16)}…`);
        showMcpSuccess(deps, `Receive address (${network})`, address.slice(0, 12) + '…');
        return {
          content: [{ type: 'text', text: JSON.stringify({ network, ticker, address }, null, 2) }],
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        mcpCallLog(`get_receive_address: error - ${network}: ${message}`);
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: message, network }, null, 2) }],
        };
      }
    }
  );

  mcp.registerTool(
    'list_tokens',
    {
      title: 'List fungible tokens and balances for a network',
      description:
        `Returns fungible tokens (not NFTs) you currently hold (non-zero balance), each with \`balance_base_units\` (smallest units), \`balance_human_readable\` (decimal string for showing the user), \`decimals\`, \`symbol\`, and \`token_id\`. Refreshes balances first. \`network\` must be one of: ${MCP_TOKEN_READ_NETWORKS.join(', ')}.\n\n` +
        MCP_BASE_UNITS_GUIDANCE +
        "\n\nFor USDB swaps on Spark (`get_swap_quote` with `send_asset` `token:spark:usdb`), use that token's `balance_base_units` **as-is** for `send_amount_base_units` when selling the full balance.\n\n" +
        '**Each `token_id` in the response must be copied exactly** (same string, character-for-character) into `transfer_token`; do not shorten, reformat, or infer from name/symbol.',
      inputSchema: {
        network: mcpTokenReadNetworkSchema.describe(`Network id; one of: ${MCP_TOKEN_READ_NETWORKS.join(', ')}.`),
      },
    },
    async ({ network }) => {
      const net = network as Networks;
      mcpCallLog(`list_tokens: start - ${net}`);
      trackMcpCall(deps, 'list_tokens');
      try {
        let tokens: Array<{ token_id: string; name: string; symbol: string; decimals: number; balance_base_units: string; balance_human_readable: string | null }>;

        if ((MCP_TOKEN_WRITE_NETWORKS as readonly string[]).includes(net)) {
          // Account-based wallets (Spark/Stacks) self-discover held tokens via the SDK.
          await balanceFetcher({ cacheKey: 'mcpListTokens', accountNumber: MCP_BALANCE_ACCOUNT_NUMBER, network: net, backgroundCaller });
          const w = await backgroundCaller.lazyInitWallet(net as TSupportedLazyInitWalletNetworks, MCP_BALANCE_ACCOUNT_NUMBER);
          if (!walletCanHaveTokens(w)) {
            mcpCallLog(`list_tokens: error - wallet cannot hold tokens (${net})`);
            return {
              isError: true,
              content: [{ type: 'text', text: JSON.stringify({ error: 'Wallet does not expose token balances for this network.', network: net }, null, 2) }],
            };
          }
          if (net === NETWORK_STACKS) {
            await w.fetchTokenBalances();
          }
          tokens = w.getTokenBalances().map((t) => {
            const balance_base_units = t.balance ?? '0';
            return {
              token_id: t.id,
              name: t.name,
              symbol: t.symbol,
              decimals: t.decimals,
              balance_base_units,
              balance_human_readable: mcpBaseUnitsToHumanReadable(balance_base_units, t.decimals),
            };
          });
        } else {
          // EVM/Liquid have no on-chain token discovery: enumerate the curated token list and
          // query each balance (ERC20 balanceOf / Breez asset balances), keeping only held tokens.
          const candidates = getTokenList(net);
          const balances = await Promise.all(
            candidates.map((t) => tokenBalanceFetcher({ cacheKey: 'mcpListTokens', accountNumber: MCP_BALANCE_ACCOUNT_NUMBER, network: net, tokenContractAddress: t.id, backgroundCaller }))
          );
          tokens = candidates
            .map((t, i) => {
              const balance_base_units = balances[i] ?? '0';
              return {
                token_id: t.id,
                name: t.name,
                symbol: t.symbol,
                decimals: t.decimals,
                balance_base_units,
                balance_human_readable: mcpBaseUnitsToHumanReadable(balance_base_units, t.decimals),
              };
            })
            .filter((t) => t.balance_base_units !== '0' && t.balance_base_units !== '');
        }

        mcpCallLog(`list_tokens: ok - ${net}, ${tokens.length} token(s)`);
        showMcpSuccess(deps, `Listed tokens (${net})`, `${tokens.length} token(s)`);
        return {
          content: [{ type: 'text', text: JSON.stringify({ network: net, tokens }, null, 2) }],
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        mcpCallLog(`list_tokens: error - ${network}: ${message}`);
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: message, network }, null, 2) }],
        };
      }
    }
  );

  mcp.registerTool(
    'transfer_token',
    {
      title: 'Transfer fungible token on a network',
      description: `Sends \`amount_base_units\` (smallest units, integer string — same as list_tokens \`balance_base_units\`) of \`token_id\` to \`receiver_address\`. \`network\` must be one of: ${MCP_TOKEN_TRANSFER_NETWORKS.join(', ')}. Call list_tokens first; **pass \`token_id\` exactly as returned** (verbatim string from the tool output). Malformed or chat-transcribed ids will fail; use the exact value from MCP JSON, not a human summary. On EVM chains (${MCP_EVM_TOKEN_TRANSFER_NETWORKS.join(', ')}) \`token_id\` is the ERC-20 contract address and the transfer pays gas in the chain's native coin. On Liquid \`token_id\` is the Liquid asset id and the fee is paid in L-BTC. Only tokens from list_tokens are supported.`,
      inputSchema: {
        network: mcpTokenTransferNetworkSchema.describe(`Network id; one of: ${MCP_TOKEN_TRANSFER_NETWORKS.join(', ')}.`),
        token_id: z
          .string()
          .min(1)
          .describe(
            'Exact `token_id` string from list_tokens for the same `network` — copy verbatim from tool output (no edits). For EVM chains this is the ERC-20 contract address. Leading/trailing whitespace is trimmed only.'
          ),
        amount_base_units: mcpPositiveBaseUnitsString.describe('Amount to send in smallest token units (positive integer string).'),
        receiver_address: z.string().min(1).describe('Recipient address (Spark: spark1…; Stacks: SP… / ST… principal; EVM: 0x… address; Liquid: lq1… / VJ… address).'),
        fee_multiplier: z
          .number()
          .int()
          .min(1)
          .max(MCP_EVM_FEE_MULTIPLIER_MAX)
          .optional()
          .describe(
            `EVM only: gas-price "speed up" multiplier, integer 1-${MCP_EVM_FEE_MULTIPLIER_MAX} (default 1 = network default). Higher values pay more gas for faster inclusion. Ignored on non-EVM networks.`
          ),
      },
    },
    async ({ network, token_id, amount_base_units, receiver_address, fee_multiplier }) => {
      const net = network;
      const tid = token_id.trim();
      const addr = receiver_address.trim();
      const feeMultiplier = fee_multiplier ?? 1;
      mcpCallLog(`transfer_token: start - ${net}, token ${tid.slice(0, 12)}… amount ${amount_base_units}`);
      trackMcpCall(deps, 'transfer_token');

      if (getIsEVM(net)) {
        if (!EvmWallet.isAddressValid(addr)) {
          mcpCallLog(`transfer_token: error - invalid EVM address (${net})`);
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: 'Invalid EVM receiver address.', network: net }, null, 2) }],
          };
        }
        try {
          // Resolve curated token metadata (throws for unlisted contracts → caught below).
          const token = getTokenInfo(tid);

          // Mirror the UI EVM token-send path (e.g. mobile SendTokenEvm.tsx): build the ERC-20
          // transfer, prepare gas with the fee multiplier, sign with the master seed, broadcast.
          const evm = new EvmWallet();
          const fromAddress = await backgroundCaller.getAddress(net, MCP_BALANCE_ACCOUNT_NUMBER);

          // Pre-flight balance check (the UI asserts the same) so we don't broadcast a tx that
          // would revert on-chain and waste gas.
          const tokenBalance = await tokenBalanceFetcher({ cacheKey: 'mcpTransferToken', accountNumber: MCP_BALANCE_ACCOUNT_NUMBER, network: net, tokenContractAddress: tid, backgroundCaller });
          if (BigInt(tokenBalance ?? '0') < BigInt(amount_base_units)) {
            mcpCallLog(`transfer_token: error - insufficient token balance (${tokenBalance ?? '0'} < ${amount_base_units})`);
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ error: 'Insufficient token balance.', network: net, token_id: tid, amount_base_units, ...mcpBalanceFields(tokenBalance ?? '0', token.decimals) }, null, 2),
                },
              ],
            };
          }

          const paymentTransaction = await evm.createTokenTransferTransaction(fromAddress, addr, token, amount_base_units);
          const feeData = await evm.getFeeData(net);
          const prepared = await evm.prepareTransaction(paymentTransaction, net, feeData, BigInt(feeMultiplier));

          let baseFee = 0n;
          try {
            baseFee = await evm.getBaseFeePerGas(net);
          } catch {}
          const fee = evm.calculateMinFee(baseFee, prepared);

          const mnemonic = await backgroundCaller.getMasterSeed();
          const signedTx = await evm.signTransaction(prepared, mnemonic, MCP_BALANCE_ACCOUNT_NUMBER);
          const transfer_id = await evm.broadcastTransaction(net, signedTx);
          if (!transfer_id || typeof transfer_id !== 'string') {
            mcpCallLog('transfer_token: error - broadcast did not return a txid (EVM)');
            return {
              isError: true,
              content: [{ type: 'text', text: JSON.stringify({ error: 'Transfer did not return an id.', network: net }, null, 2) }],
            };
          }
          mcpCallLog(`transfer_token: ok - ${net} ${transfer_id}`);
          showMcpSuccess(deps, `Sent token (${net})`, transfer_id.slice(0, 16));
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    network: net,
                    transfer_id,
                    token_id: tid,
                    amount_base_units,
                    receiver_address: addr,
                    fee_base_units: fee,
                    fee_ticker: getTickerByNetwork(net),
                    fee_multiplier: feeMultiplier,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          mcpCallLog(`transfer_token: error - ${net}: ${message}`);
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: message, network: net }, null, 2) }],
          };
        }
      }

      if (net === NETWORK_LIQUID) {
        if (!BreezWallet.isAddressValid(addr)) {
          mcpCallLog(`transfer_token: error - invalid Liquid address`);
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: 'Invalid Liquid receiver address.', network: net }, null, 2) }],
          };
        }
        try {
          // Resolve curated token metadata (throws for unlisted asset ids → caught below).
          const token = getTokenInfo(tid);

          const wallet = await backgroundCaller.lazyInitWallet(NETWORK_LIQUID, MCP_BALANCE_ACCOUNT_NUMBER);
          if (!(wallet instanceof BreezWallet)) {
            mcpCallLog(`transfer_token: error - not a Breez wallet (liquid)`);
            return {
              isError: true,
              content: [{ type: 'text', text: JSON.stringify({ error: 'Wallet does not support Liquid token transfers.', network: net }, null, 2) }],
            };
          }

          // Pre-flight balance check (the UI validates the same) so we don't attempt a transfer
          // the SDK would reject.
          const tokenBalance = await tokenBalanceFetcher({
            cacheKey: 'mcpTransferToken',
            accountNumber: MCP_BALANCE_ACCOUNT_NUMBER,
            network: NETWORK_LIQUID,
            tokenContractAddress: tid,
            backgroundCaller,
          });
          if (BigInt(tokenBalance ?? '0') < BigInt(amount_base_units)) {
            mcpCallLog(`transfer_token: error - insufficient token balance (${tokenBalance ?? '0'} < ${amount_base_units})`);
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ error: 'Insufficient token balance.', network: net, token_id: tid, amount_base_units, ...mcpBalanceFields(tokenBalance ?? '0', token.decimals) }, null, 2),
                },
              ],
            };
          }

          // Mirror the UI Liquid token-send path (mobile send/send-amount-usdt.tsx → send-confirm.tsx):
          // prepareSendPayment with an asset amount, then sendPayment. The SDK takes a human (decimal)
          // receiver amount, not base units — convert exactly from the integer base-unit string.
          const receiverAmount = new BigNumber(amount_base_units).dividedBy(new BigNumber(10).pow(token.decimals)).toNumber();
          const prepareResponse = await wallet.prepareSendPayment({ destination: addr, amount: { type: 'asset', toAsset: tid, receiverAmount } });
          const sendResponse = await wallet.sendPayment({ prepareResponse });
          const transfer_id = sendResponse.payment.txId;
          if (!transfer_id) {
            mcpCallLog('transfer_token: error - send did not return a txid (liquid)');
            return {
              isError: true,
              content: [{ type: 'text', text: JSON.stringify({ error: 'Transfer did not return an id.', network: net }, null, 2) }],
            };
          }
          mcpCallLog(`transfer_token: ok - ${net} ${transfer_id}`);
          showMcpSuccess(deps, `Sent token (${net})`, transfer_id.slice(0, 16));
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    network: net,
                    transfer_id,
                    token_id: tid,
                    amount_base_units,
                    receiver_address: addr,
                    fee_base_units: String(prepareResponse.feesSat ?? ''),
                    fee_ticker: 'L-BTC',
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          mcpCallLog(`transfer_token: error - ${net}: ${message}`);
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: message, network: net }, null, 2) }],
          };
        }
      }

      if (network === NETWORK_SPARK && !isValidSparkAddress(addr)) {
        mcpCallLog(`transfer_token: error - invalid Spark address`);
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: 'Invalid Spark receiver address.', network }, null, 2),
            },
          ],
        };
      }
      if (network === NETWORK_STACKS && !validateAddress(NETWORK_STACKS, addr)) {
        mcpCallLog(`transfer_token: error - invalid Stacks address`);
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: 'Invalid Stacks receiver address.', network }, null, 2) }],
        };
      }

      const amount = BigInt(amount_base_units);
      if (network === NETWORK_STACKS && tid === 'STX' && amount > BigInt(Number.MAX_SAFE_INTEGER)) {
        mcpCallLog(`transfer_token: error - STX amount exceeds safe numeric limit`);
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: `STX transfer amount exceeds maximum supported (${Number.MAX_SAFE_INTEGER} micro-STX). Split the transfer or use a smaller amount.`,
                  network,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      try {
        await balanceFetcher({
          cacheKey: 'mcpTransferToken',
          accountNumber: MCP_BALANCE_ACCOUNT_NUMBER,
          network: net,
          backgroundCaller,
        });
        const w = await backgroundCaller.lazyInitWallet(net as TSupportedLazyInitWalletNetworks, MCP_BALANCE_ACCOUNT_NUMBER);
        if (!walletCanHaveTokens(w)) {
          mcpCallLog(`transfer_token: error - no token support (${network})`);
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: 'Wallet does not support token transfers on this network.', network }, null, 2) }],
          };
        }

        if (network === NETWORK_STACKS) {
          await w.fetchTokenBalances();
        }

        const holding = w.getTokenBalances().find((t) => t.id === tid);
        const available = BigInt(holding?.balance ?? '0');
        if (!holding) {
          mcpCallLog(`transfer_token: error - token not in fungible list (${network})`);
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    error: 'Unknown token or not a listed fungible token. Run list_tokens for this network and use a token_id from that list.',
                    network,
                    token_id: tid,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
        if (available < amount) {
          mcpCallLog(`transfer_token: error - insufficient balance (${available} < ${amount})`);
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    error: 'Insufficient token balance.',
                    network,
                    token_id: tid,
                    amount_base_units,
                    ...mcpBalanceFields(holding.balance ?? '0', holding.decimals),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const transfer_id = await w.transferToken(tid, amount, addr);
        if (!transfer_id) {
          mcpCallLog('transfer_token: error - empty transfer id');
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: 'Transfer did not return an id.', network }, null, 2) }],
          };
        }
        mcpCallLog(`transfer_token: ok - ${network} ${transfer_id}`);
        showMcpSuccess(deps, `Sent token (${network})`, transfer_id.slice(0, 16));
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  network,
                  transfer_id,
                  token_id: tid,
                  amount_base_units,
                  receiver_address: addr,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        mcpCallLog(`transfer_token: error - ${network}: ${message}`);
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: message, network }, null, 2) }],
        };
      }
    }
  );

  mcp.registerTool(
    'transfer_native',
    {
      title: "Transfer a network's native coin",
      description: `Sends \`amount_base_units\` (smallest units, integer string — same scale as get_network_balance \`balance_base_units\`) of the network's native coin to \`receiver_address\`. \`network\` must be one of: ${MCP_NATIVE_TRANSFER_NETWORKS.join(', ')}. The fee is paid in that same native coin and deducted on top of \`amount_base_units\`. For fungible tokens use transfer_token instead.`,
      inputSchema: {
        network: mcpNativeTransferNetworkSchema.describe(`Network id; one of: ${MCP_NATIVE_TRANSFER_NETWORKS.join(', ')}.`),
        amount_base_units: mcpPositiveBaseUnitsString.describe('Amount of native coin to send in smallest units (positive integer string; e.g. wei on EVM chains).'),
        receiver_address: z.string().min(1).describe('Recipient address for the chosen network (e.g. 0x… on EVM chains). Leading/trailing whitespace is trimmed only.'),
        fee_multiplier: z
          .number()
          .int()
          .min(1)
          .max(MCP_EVM_FEE_MULTIPLIER_MAX)
          .optional()
          .describe(
            `EVM only: gas-price "speed up" multiplier, integer 1-${MCP_EVM_FEE_MULTIPLIER_MAX} (default 1 = network default). Higher values pay more gas for faster inclusion. Ignored on non-EVM networks.`
          ),
      },
    },
    async ({ network, amount_base_units, receiver_address, fee_multiplier }) => {
      const net = network;
      const addr = receiver_address.trim();
      const feeMultiplier = fee_multiplier ?? 1;
      mcpCallLog(`transfer_native: start - ${net}, amount ${amount_base_units}`);
      trackMcpCall(deps, 'transfer_native');

      if (getIsEVM(net)) {
        if (!EvmWallet.isAddressValid(addr)) {
          mcpCallLog(`transfer_native: error - invalid EVM address (${net})`);
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: 'Invalid EVM receiver address.', network: net }, null, 2) }],
          };
        }

        try {
          // Mirror the UI EVM coin-send path: build the value transfer, prepare gas with the fee
          // multiplier, sign with the master seed, broadcast.
          const evm = new EvmWallet();
          const fromAddress = await backgroundCaller.getAddress(net, MCP_BALANCE_ACCOUNT_NUMBER);

          const paymentTransaction = await evm.createPaymentTransaction(fromAddress, addr, amount_base_units);
          const feeData = await evm.getFeeData(net);
          const prepared = await evm.prepareTransaction(paymentTransaction, net, feeData, BigInt(feeMultiplier));

          let baseFee = 0n;
          try {
            baseFee = await evm.getBaseFeePerGas(net);
          } catch {}
          const fee = evm.calculateMinFee(baseFee, prepared);

          // Pre-flight: native balance must cover amount + gas (the UI's getSendQuote asserts the
          // same) so we don't broadcast a tx that would fail at the node.
          const nativeBalance = await balanceFetcher({ cacheKey: 'mcpTransferNative', accountNumber: MCP_BALANCE_ACCOUNT_NUMBER, network: net, backgroundCaller });
          if (BigInt(nativeBalance ?? '0') < BigInt(amount_base_units) + BigInt(fee)) {
            mcpCallLog(`transfer_native: error - insufficient balance (have ${nativeBalance ?? '0'}, need amount+fee)`);
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      error: `Insufficient ${getTickerByNetwork(net)} balance for amount + gas.`,
                      network: net,
                      amount_base_units,
                      fee_base_units: fee,
                      ...mcpBalanceFields(nativeBalance ?? '0', getDecimalsByNetwork(net)),
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          const mnemonic = await backgroundCaller.getMasterSeed();
          const signedTx = await evm.signTransaction(prepared, mnemonic, MCP_BALANCE_ACCOUNT_NUMBER);
          const transfer_id = await evm.broadcastTransaction(net, signedTx);
          if (!transfer_id || typeof transfer_id !== 'string') {
            mcpCallLog('transfer_native: error - broadcast did not return a txid');
            return {
              isError: true,
              content: [{ type: 'text', text: JSON.stringify({ error: 'Transfer did not return an id.', network: net }, null, 2) }],
            };
          }
          mcpCallLog(`transfer_native: ok - ${net} ${transfer_id}`);
          showMcpSuccess(deps, `Sent ${getTickerByNetwork(net)} (${net})`, transfer_id.slice(0, 16));
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    network: net,
                    transfer_id,
                    amount_base_units,
                    receiver_address: addr,
                    fee_base_units: fee,
                    fee_ticker: getTickerByNetwork(net),
                    fee_multiplier: feeMultiplier,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          mcpCallLog(`transfer_native: error - ${net}: ${message}`);
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: message, network: net }, null, 2) }],
          };
        }
      }

      // Liquid native L-BTC send. Mirrors the UI native send (mobile send/send-amount-liquid.tsx
      // → send/send-confirm.tsx, ext SendLiquid.tsx) and the transfer_token Liquid branch: L-BTC is
      // just a Liquid *asset* (the L-BTC asset id), sent via `prepareSendPayment` with a decimal
      // `receiverAmount` then `sendPayment`. The Breez SDK takes a human (decimal) amount, so convert
      // from the integer sats string (amount_base_units / 10^decimals).
      if (net === NETWORK_LIQUID) {
        if (!BreezWallet.isAddressValid(addr)) {
          mcpCallLog(`transfer_native: error - invalid Liquid address`);
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: 'Invalid Liquid receiver address.', network: net }, null, 2) }],
          };
        }

        try {
          const wallet = await backgroundCaller.lazyInitWallet(NETWORK_LIQUID, MCP_BALANCE_ACCOUNT_NUMBER);
          if (!(wallet instanceof BreezWallet)) {
            mcpCallLog(`transfer_native: error - not a Breez wallet (liquid)`);
            return {
              isError: true,
              content: [{ type: 'text', text: JSON.stringify({ error: 'Wallet does not support native transfers on this network.', network: net }, null, 2) }],
            };
          }

          // L-BTC is the UI's default Liquid asset (LBTC_ASSET_IDS). MCP only exposes mainnet Liquid,
          // so the mainnet asset id is correct. Breez wants a decimal receiver amount → convert from sats.
          // The SDK enforces balance/fee itself (an insufficient send throws → surfaced below), so no
          // pre-flight balance check — same as the account-based branch.
          const decimals = getDecimalsByNetwork(net);
          const receiverAmount = new BigNumber(amount_base_units).dividedBy(new BigNumber(10).pow(decimals)).toNumber();
          const prepareResponse = await wallet.prepareSendPayment({ destination: addr, amount: { type: 'asset', toAsset: LBTC_ASSET_IDS.mainnet, receiverAmount } });
          const sendResponse = await wallet.sendPayment({ prepareResponse });
          const transfer_id = sendResponse.payment.txId;
          if (!transfer_id) {
            mcpCallLog('transfer_native: error - send did not return a txid (liquid)');
            return {
              isError: true,
              content: [{ type: 'text', text: JSON.stringify({ error: 'Transfer did not return an id.', network: net }, null, 2) }],
            };
          }
          mcpCallLog(`transfer_native: ok - ${net} ${transfer_id}`);
          showMcpSuccess(deps, `Sent ${getTickerByNetwork(net)} (${net})`, transfer_id.slice(0, 16));
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  { success: true, network: net, transfer_id, amount_base_units, receiver_address: addr, fee_base_units: String(prepareResponse.feesSat ?? ''), fee_ticker: 'L-BTC' },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          mcpCallLog(`transfer_native: error - ${net}: ${message}`);
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: message, network: net }, null, 2) }],
          };
        }
      }

      // Account-based native sends (Spark BTC, Stacks sBTC, …): single-address wallets. One shared
      // codepath for every such network — mirrors the UI's single SendAccountBased screen:
      // validate the address, instantiate the wallet, narrow via the `walletIsAccountBased` trait,
      // then `pay(addr, amountSats)`. The wallet enforces its own balance/preconditions (Spark via
      // the SDK; Stacks `pay()` loads its sBTC balance on demand), so no per-network branching here.
      if (!getIsEVM(net)) {
        if (!validateAddress(net, addr)) {
          mcpCallLog(`transfer_native: error - invalid receiver address (${net})`);
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: 'Invalid receiver address for this network.', network: net }, null, 2) }],
          };
        }

        try {
          const w = await backgroundCaller.lazyInitWallet(net as TSupportedLazyInitWalletNetworks, MCP_BALANCE_ACCOUNT_NUMBER);
          if (!walletIsAccountBased(w)) {
            mcpCallLog(`transfer_native: error - wallet is not account-based (${net})`);
            return {
              isError: true,
              content: [{ type: 'text', text: JSON.stringify({ error: 'Wallet does not support native transfers on this network.', network: net }, null, 2) }],
            };
          }

          const transfer_id = await w.pay(addr, Number(amount_base_units));
          if (!transfer_id || typeof transfer_id !== 'string') {
            mcpCallLog('transfer_native: error - pay did not return a txid');
            return {
              isError: true,
              content: [{ type: 'text', text: JSON.stringify({ error: 'Transfer did not return an id.', network: net }, null, 2) }],
            };
          }
          mcpCallLog(`transfer_native: ok - ${net} ${transfer_id}`);
          showMcpSuccess(deps, `Sent ${getTickerByNetwork(net)} (${net})`, transfer_id.slice(0, 16));
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, network: net, transfer_id, amount_base_units, receiver_address: addr, fee_ticker: getTickerByNetwork(net) }, null, 2),
              },
            ],
          };
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          mcpCallLog(`transfer_native: error - ${net}: ${message}`);
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: message, network: net }, null, 2) }],
          };
        }
      }

      // Unreachable (every listable network is either EVM or account-based above), but keeps the
      // handler total for the type checker and guards against future enum additions.
      mcpCallLog(`transfer_native: error - unsupported network ${net}`);
      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ error: `Native transfer is not supported for network "${net}".`, network: net }, null, 2) }],
      };
    }
  );

  // ── Native (on-chain) Bitcoin send ──────────────────────────────────────────────────────────────
  // Bitcoin is UTXO-based and irreversible, so it gets a quote→execute flow (like get_swap_quote /
  // execute_swap) rather than a slot in transfer_native: get_bitcoin_fee_rates → get_bitcoin_send_quote
  // → execute_bitcoin_send. These are thin adapters over the WatchOnlyWallet's InterfaceSendQuotable
  // (getSendQuote / executeSendQuote) — the same engine the UI Bitcoin send screens use.

  mcp.registerTool(
    'get_bitcoin_fee_rates',
    {
      title: 'Get Bitcoin fee rate options (sat/vByte)',
      description:
        'Returns reference on-chain Bitcoin fee rates in sat/vByte as `{ low, medium, high }`. Pick one (or any integer in between) to pass as `fee_rate` to `get_bitcoin_send_quote`. Higher rate = faster confirmation. Read-only; no funds move.',
    },
    async () => {
      mcpCallLog('get_bitcoin_fee_rates: start');
      trackMcpCall(deps, 'get_bitcoin_fee_rates');
      try {
        if (!BlueElectrum.mainConnected) await BlueElectrum.connectMain();
        const { fast, medium, slow } = await BlueElectrum.estimateFees();
        mcpCallLog(`get_bitcoin_fee_rates: ok - low ${slow}, medium ${medium}, high ${fast} sat/vByte`);
        showMcpSuccess(deps, 'Fetched Bitcoin fee rates', `low ${slow} · med ${medium} · high ${fast} sat/vB`);
        return {
          content: [{ type: 'text', text: JSON.stringify({ low: slow, medium, high: fast, unit: 'sat/vByte' }, null, 2) }],
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        mcpCallLog(`get_bitcoin_fee_rates: error - ${message}`);
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
        };
      }
    }
  );

  mcp.registerTool(
    'get_bitcoin_send_quote',
    {
      title: 'Quote a native Bitcoin (on-chain) send',
      description:
        'Prepares an on-chain Bitcoin (BTC) send of `amount_base_units` sats to `receiver_address` at `fee_rate` (sat/vByte). Returns a `quote_id` plus the exact `fee_base_units` (sats) and `total_base_units` (amount + fee) so you can review the fee before committing. **No funds move on this call** — call `execute_bitcoin_send` with the `quote_id` to actually sign and broadcast.\n\n' +
        MCP_BASE_UNITS_GUIDANCE +
        `\n\n\`amount_base_units\` is sats — the same scale as get_network_balance \`balance_base_units\` for bitcoin. Get \`fee_rate\` from get_bitcoin_fee_rates (low/medium/high) or pick any integer sat/vByte. The quote is rejected if the fee would exceed ${MCP_BTC_MAX_FEE_PERCENT_OF_AMOUNT}% of the amount (lower fee_rate or send more).`,
      inputSchema: {
        receiver_address: z.string().min(1).describe('Recipient Bitcoin address (bc1…, 3…, or 1…). Leading/trailing whitespace is trimmed only.'),
        amount_base_units: mcpPositiveBaseUnitsString.describe('Amount to send in sats (positive integer string).'),
        fee_rate: z.number().int().min(1).describe('Fee rate in sat/vByte. Use a value from get_bitcoin_fee_rates (low/medium/high) or any integer you choose — no upper bound, you own this choice.'),
      },
    },
    async ({ receiver_address, amount_base_units, fee_rate }) => {
      const addr = receiver_address.trim();
      mcpCallLog(`get_bitcoin_send_quote: start - amount ${amount_base_units} sats, fee_rate ${fee_rate} sat/vByte`);
      trackMcpCall(deps, 'get_bitcoin_send_quote');

      if (!validateAddress(NETWORK_BITCOIN, addr)) {
        mcpCallLog('get_bitcoin_send_quote: error - invalid Bitcoin address');
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: 'Invalid Bitcoin receiver address.', network: NETWORK_BITCOIN }, null, 2) }],
        };
      }

      try {
        const w = await backgroundCaller.lazyInitWallet(NETWORK_BITCOIN, MCP_BALANCE_ACCOUNT_NUMBER);
        if (!walletCanSendQuote(w)) {
          mcpCallLog('get_bitcoin_send_quote: error - wallet cannot quote sends');
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: 'Wallet does not support Bitcoin sends.', network: NETWORK_BITCOIN }, null, 2) }],
          };
        }

        // getSendQuote connects Electrum, fetches balance + UTXOs, runs coinselect at fee_rate, and
        // builds the unsigned PSBT. It throws on insufficient funds (caught below). No funds move.
        const quote = await w.getSendQuote({ toAddress: addr, amount: amount_base_units, feeRate: fee_rate });

        const amount = BigInt(amount_base_units);
        const fee = BigInt(quote.fee);
        if (fee * 100n > amount * BigInt(MCP_BTC_MAX_FEE_PERCENT_OF_AMOUNT)) {
          mcpCallLog(`get_bitcoin_send_quote: error - fee ${fee} exceeds ${MCP_BTC_MAX_FEE_PERCENT_OF_AMOUNT}% of amount ${amount}`);
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    error: `Fee (${fee.toString()} sats) exceeds ${MCP_BTC_MAX_FEE_PERCENT_OF_AMOUNT}% of the send amount (${amount.toString()} sats). Lower fee_rate or send a larger amount.`,
                    network: NETWORK_BITCOIN,
                    fee_base_units: quote.fee,
                    amount_base_units,
                    fee_rate,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const quoteId = crypto.randomUUID();
        btcSendQuotes.set(quoteId, quote);

        mcpCallLog(`get_bitcoin_send_quote: ok - quote_id ${quoteId}, fee ${quote.fee} sats`);
        showMcpSuccess(deps, 'Quoted Bitcoin send', `${amount_base_units} sats · fee ${quote.fee} sats`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  quote_id: quoteId,
                  network: NETWORK_BITCOIN,
                  receiver_address: addr,
                  amount_base_units,
                  fee_base_units: quote.fee,
                  fee_rate,
                  fee_ticker: 'BTC',
                  total_base_units: (amount + fee).toString(),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        mcpCallLog(`get_bitcoin_send_quote: error - ${message}`);
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: message, network: NETWORK_BITCOIN }, null, 2) }],
        };
      }
    }
  );

  mcp.registerTool(
    'execute_bitcoin_send',
    {
      title: 'Execute a previously quoted Bitcoin send',
      description:
        'Signs and broadcasts the on-chain Bitcoin send staged by an earlier `get_bitcoin_send_quote`. Pass `quote_id` exactly as returned. This is **irreversible** once it returns a `transfer_id` (the txid). Each `quote_id` is single-use; an unknown or already-used id returns an error (re-quote). If a coin in the quote was spent elsewhere in the meantime the broadcast fails — re-quote and try again.',
      inputSchema: {
        quote_id: z.string().min(1).describe('Exact `quote_id` from get_bitcoin_send_quote — copy verbatim. Leading/trailing whitespace is trimmed.'),
      },
    },
    async ({ quote_id }) => {
      const qid = quote_id.trim();
      mcpCallLog(`execute_bitcoin_send: start - quote_id ${qid}`);
      trackMcpCall(deps, 'execute_bitcoin_send');

      const quote = btcSendQuotes.get(qid);
      if (!quote) {
        mcpCallLog('execute_bitcoin_send: error - unknown or already-used quote_id');
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: 'Unknown or already-used quote_id. Call get_bitcoin_send_quote again.', quote_id: qid }, null, 2) }],
        };
      }

      try {
        const w = await backgroundCaller.lazyInitWallet(NETWORK_BITCOIN, MCP_BALANCE_ACCOUNT_NUMBER);
        if (!walletCanSendQuote(w)) {
          mcpCallLog('execute_bitcoin_send: error - wallet cannot execute sends');
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: 'Wallet does not support Bitcoin sends.', network: NETWORK_BITCOIN }, null, 2) }],
          };
        }

        const mnemonic = await backgroundCaller.getMasterSeed();
        const transfer_id = await w.executeSendQuote(quote, mnemonic, MCP_BALANCE_ACCOUNT_NUMBER);
        if (!transfer_id || typeof transfer_id !== 'string') {
          mcpCallLog('execute_bitcoin_send: error - broadcast did not return a txid');
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: 'Transfer did not return an id.', network: NETWORK_BITCOIN }, null, 2) }],
          };
        }

        // Single-use: consume the quote only after a successful broadcast, so a failed attempt
        // (e.g. a coin spent elsewhere) leaves the entry for the agent to inspect / re-quote.
        btcSendQuotes.delete(qid);

        mcpCallLog(`execute_bitcoin_send: ok - ${transfer_id}`);
        showMcpSuccess(deps, 'Sent BTC (bitcoin)', transfer_id.slice(0, 16));
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  network: NETWORK_BITCOIN,
                  transfer_id,
                  receiver_address: quote.request.toAddress,
                  amount_base_units: quote.request.amount,
                  fee_base_units: quote.fee,
                  fee_rate: quote.request.feeRate,
                  fee_ticker: 'BTC',
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        mcpCallLog(`execute_bitcoin_send: error - ${message}`);
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: message, network: NETWORK_BITCOIN }, null, 2) }],
        };
      }
    }
  );

  mcp.registerTool(
    'get_bitcoin_transaction',
    {
      title: 'Look up a Bitcoin transaction by txid',
      description:
        'Fetches an on-chain Bitcoin transaction by `txid` (the `transfer_id` returned by `execute_bitcoin_send`, or any other Bitcoin txid). Returns confirmation status, block info, size, and a compact summary of inputs/outputs (output addresses + amounts). Use this to check whether a send has confirmed and how deep, or to inspect any Bitcoin transaction. Read-only; no funds move.\n\n' +
        'Output amounts are in sats (`value_base_units`) — same scale as `get_network_balance` for bitcoin — and are paired with `value_human_readable` (BTC, with `ticker` on the payload). `status` is `confirmed` when `confirmations >= 1`, otherwise `mempool`. Input prevouts are returned as `{txid, vout}` pointers; input amounts (and therefore the fee) are not reconstructed (would require N+1 lookups). Quote `*_human_readable` to the user; use `*_base_units` only for further programmatic calls.',
      inputSchema: {
        txid: z
          .string()
          .regex(/^[0-9a-fA-F]{64}$/, 'txid must be a 64-char hex string (as returned by `execute_bitcoin_send` in `transfer_id`).')
          .describe('Bitcoin transaction id, 64-char hex. Pass exactly as returned by `execute_bitcoin_send` (`transfer_id`) — do not transcribe from chat.'),
      },
    },
    async ({ txid }) => {
      const txidNorm = txid.trim().toLowerCase();
      mcpCallLog(`get_bitcoin_transaction: start - ${txidNorm}`);
      trackMcpCall(deps, 'get_bitcoin_transaction');
      try {
        if (!BlueElectrum.mainConnected) await BlueElectrum.connectMain();
        const result = await BlueElectrum.multiGetTransactionByTxid([txidNorm], true);
        const tx = result[txidNorm];
        if (!tx) {
          mcpCallLog(`get_bitcoin_transaction: not found - ${txidNorm}`);
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    error: 'Transaction not found. The txid may be invalid, not yet broadcast, or evicted from the mempool.',
                    txid: txidNorm,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const confirmations = typeof tx.confirmations === 'number' ? tx.confirmations : 0;
        const status = confirmations >= 1 ? 'confirmed' : 'mempool';

        const btcDecimals = getDecimalsByNetwork(NETWORK_BITCOIN);

        let totalOutputSats = new BigNumber(0);
        const outputs = (tx.vout ?? []).map((o) => {
          const sats = new BigNumber(o.value).multipliedBy(1e8).integerValue(BigNumber.ROUND_HALF_UP).toFixed(0);
          totalOutputSats = totalOutputSats.plus(sats);
          return {
            n: o.n,
            value_base_units: sats,
            value_human_readable: mcpBaseUnitsToHumanReadable(sats, btcDecimals),
            address: o.scriptPubKey?.addresses?.[0] ?? null,
          };
        });

        const inputs = (tx.vin ?? []).map((i) => ({ txid: i.txid, vout: i.vout }));

        const totalOutput = totalOutputSats.toFixed(0);
        const payload = {
          txid: tx.txid,
          status,
          confirmations,
          blockhash: tx.blockhash || null,
          block_time: tx.blocktime || tx.time || null,
          size: tx.size,
          vsize: tx.vsize,
          input_count: inputs.length,
          inputs,
          output_count: outputs.length,
          outputs,
          total_output_base_units: totalOutput,
          total_output_human_readable: mcpBaseUnitsToHumanReadable(totalOutput, btcDecimals),
          ticker: getTickerByNetwork(NETWORK_BITCOIN),
        };

        mcpCallLog(`get_bitcoin_transaction: ok - ${txidNorm} ${status} confirmations=${confirmations}`);
        showMcpSuccess(deps, 'Fetched Bitcoin transaction', `${status} · ${confirmations} conf`);
        return {
          content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        mcpCallLog(`get_bitcoin_transaction: error - ${message}`);
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: message, txid: txidNorm }, null, 2) }],
        };
      }
    }
  );

  // ── On-chain BTC → Spark (deposit + claim) ──────────────────────────────────────────────────────
  // Moving native (L1) BTC into the Spark balance is a deposit-address flow, not an instant swap, so
  // it can't ride on get_swap_quote/execute_swap (those are Flashnet's atomic in-wallet trades). It
  // composes the existing Bitcoin send tools instead: get_spark_deposit_address → get_bitcoin_send_quote
  // → execute_bitcoin_send → (3 confirmations) → claim_spark_deposit. The deposit address is the
  // SparkWallet's static on-chain address; claiming credits the confirmed UTXO(s) to the Spark balance.

  mcp.registerTool(
    'get_spark_deposit_address',
    {
      title: 'Get the on-chain Bitcoin deposit address for Spark',
      description:
        "Returns the wallet's **static on-chain Bitcoin deposit address** for funding the Spark balance with native (L1) BTC. This is NOT the same as `get_receive_address` for `spark` (which returns a `spark1…` address for Spark-native transfers) — this is a Bitcoin `bc1…` address you send on-chain BTC to.\n\n" +
        'Full flow to move on-chain BTC into Spark:\n' +
        '1. Call this tool to get the `deposit_address`.\n' +
        '2. Send BTC to it on-chain with `get_bitcoin_send_quote` (`receiver_address` = this address) then `execute_bitcoin_send`. An external sender works too.\n' +
        `3. Wait for **${SPARK_STATIC_DEPOSIT_CONFIRMATIONS} on-chain confirmations** (~30+ min).\n` +
        '4. Call `claim_spark_deposit` to credit the funds to the Spark balance.\n\n' +
        'The address is static and reusable — it can receive multiple deposits. Read-only; no funds move.',
    },
    async () => {
      mcpCallLog('get_spark_deposit_address: start');
      trackMcpCall(deps, 'get_spark_deposit_address');
      try {
        const w = await backgroundCaller.lazyInitWallet(NETWORK_SPARK, MCP_BALANCE_ACCOUNT_NUMBER);
        if (!(w instanceof SparkWallet)) {
          mcpCallLog('get_spark_deposit_address: error - wallet does not support Spark deposits');
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: 'Wallet does not support on-chain Spark deposits.', network: NETWORK_SPARK }, null, 2) }],
          };
        }

        const deposit_address = await w.getOnchainDepositAddress();
        mcpCallLog(`get_spark_deposit_address: ok - ${deposit_address.slice(0, 16)}…`);
        showMcpSuccess(deps, 'Spark deposit address', deposit_address.slice(0, 12) + '…');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  network: NETWORK_SPARK,
                  deposit_address,
                  deposit_chain: NETWORK_BITCOIN,
                  confirmations_required: SPARK_STATIC_DEPOSIT_CONFIRMATIONS,
                  next_step: `Send on-chain BTC to deposit_address via get_bitcoin_send_quote + execute_bitcoin_send, then call claim_spark_deposit once it has ${SPARK_STATIC_DEPOSIT_CONFIRMATIONS} confirmations.`,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        mcpCallLog(`get_spark_deposit_address: error - ${message}`);
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: message, network: NETWORK_SPARK }, null, 2) }],
        };
      }
    }
  );

  mcp.registerTool(
    'claim_spark_deposit',
    {
      title: 'Claim on-chain BTC deposited to the Spark address',
      description: `Credits on-chain BTC sent to the Spark deposit address (see \`get_spark_deposit_address\`) into the Spark balance. A deposit becomes claimable only after **${SPARK_STATIC_DEPOSIT_CONFIRMATIONS} on-chain confirmations**. By default this claims **every** currently-claimable deposit; pass \`txid\` to claim one specific deposit. Returns each claimed deposit with its Spark \`transfer_id\` and \`credited_base_units\` (sats). If nothing is claimable yet, returns the \`pending\` deposits with their confirmation progress so you can tell the user how long to wait. Each deposit can only be claimed once.`,
      inputSchema: {
        txid: z
          .string()
          .min(1)
          .optional()
          .describe(
            "Optional: the on-chain deposit txid to claim (the `transfer_id` from `execute_bitcoin_send`, or a txid from this tool's `pending` list). Omit to claim every claimable deposit. Leading/trailing whitespace is trimmed."
          ),
      },
    },
    async ({ txid }) => {
      const wantTxid = txid?.trim();
      mcpCallLog(`claim_spark_deposit: start${wantTxid ? ` - txid ${wantTxid}` : ' - all claimable'}`);
      trackMcpCall(deps, 'claim_spark_deposit');
      try {
        const w = await backgroundCaller.lazyInitWallet(NETWORK_SPARK, MCP_BALANCE_ACCOUNT_NUMBER);
        if (!(w instanceof SparkWallet)) {
          mcpCallLog('claim_spark_deposit: error - wallet does not support Spark deposits');
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: 'Wallet does not support on-chain Spark deposits.', network: NETWORK_SPARK }, null, 2) }],
          };
        }

        const swaps = await w.getCommonSwaps();
        const claimable = swaps.filter((s) => s.status === 'claimable' && (!wantTxid || s.id === wantTxid));

        if (claimable.length === 0) {
          const pending = swaps
            .filter((s) => s.status === 'pending' && (!wantTxid || s.id === wantTxid))
            .map((s) => ({
              txid: s.id,
              confirmations: s.confirmations ?? 0,
              target_confirmations: s.targetConfirmations ?? SPARK_STATIC_DEPOSIT_CONFIRMATIONS,
              amount_base_units: s.amount != null ? String(s.amount) : null,
            }));
          mcpCallLog(`claim_spark_deposit: nothing claimable (${pending.length} pending)`);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    claimed: [],
                    pending,
                    message: wantTxid
                      ? `Deposit ${wantTxid} is not claimable yet (needs ${SPARK_STATIC_DEPOSIT_CONFIRMATIONS} confirmations) or was not found.`
                      : `No claimable deposits. Pending deposits (if any) need ${SPARK_STATIC_DEPOSIT_CONFIRMATIONS} confirmations.`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const claimed: { txid: string; transfer_id?: string; credited_base_units: string }[] = [];
        const failed: { txid: string; error: string }[] = [];
        for (const swap of claimable) {
          try {
            const quote = await w.getDepositQuote(swap.id);
            const transferId = await w.claimDepositSpark(quote);
            claimed.push({ txid: swap.id, transfer_id: transferId, credited_base_units: String(quote.creditAmountSats) });

            // Count the claim as a completed BTC → Spark swap. This path bypasses the
            // TransferServiceManager (so `onTransferCompleted` never fires for it), so we emit the
            // `swap_completed` event ourselves via the platform-injected hook. Provider 'Native' and the
            // BTC→Spark asset pair mirror what the UI-driven NativeDeposit flow reports.
            const now = Math.floor(Date.now() / 1000);
            const creditBtc = new BigNumber(quote.creditAmountSats).div(1e8).toFixed();
            const completedExecution: NativeClaimExecution = {
              type: EXECUTION_CLAIM,
              id: transferId ?? swap.id,
              status: 'completed',
              sendAsset: 'native:bitcoin',
              receiveAsset: 'native:spark',
              sendAmount: creditBtc,
              receiveAmount: creditBtc,
              createdAt: swap.timestamp ? Math.floor(swap.timestamp / 1000) : now,
              updatedAt: now,
              accountNumber: MCP_BALANCE_ACCOUNT_NUMBER,
              serviceName: 'Native',
              depositTxid: swap.id,
              receiveTransferId: transferId,
              autoClaim: false,
              autoClaimAttempts: 0,
            };
            deps.trackSwapCompleted?.(completedExecution);
          } catch (e) {
            failed.push({ txid: swap.id, error: e instanceof Error ? e.message : String(e) });
          }
        }

        if (claimed.length === 0) {
          mcpCallLog(`claim_spark_deposit: error - all ${failed.length} claim(s) failed`);
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: 'All claim attempts failed.', network: NETWORK_SPARK, failed }, null, 2) }],
          };
        }

        const totalSats = claimed.reduce((acc, c) => acc + Number(c.credited_base_units), 0);
        mcpCallLog(`claim_spark_deposit: ok - claimed ${claimed.length}, ${totalSats} sats${failed.length ? `, ${failed.length} failed` : ''}`);
        showMcpSuccess(deps, 'Claimed Spark deposit', `${claimed.length} deposit(s) · ${totalSats} sats`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  network: NETWORK_SPARK,
                  claimed,
                  failed: failed.length ? failed : undefined,
                  total_credited_base_units: String(totalSats),
                  fee_ticker: 'BTC',
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        mcpCallLog(`claim_spark_deposit: error - ${message}`);
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: message, network: NETWORK_SPARK }, null, 2) }],
        };
      }
    }
  );

  mcp.registerTool(
    'list_nfts',
    {
      title: 'List NFTs owned on a network',
      description: `Returns NFTs held by this wallet with \`contract_address\`, \`token_id\`, \`name\`, \`collection_name\`, \`description\`, and \`image\`. Refreshes from chain first. \`network\` must be one of: ${MCP_NFT_NETWORKS.join(', ')}. **Both \`contract_address\` and \`token_id\` must be copied exactly** (character-for-character) into \`transfer_nft\`; do not shorten, reformat, or infer from name. NFT discovery can take several seconds.`,
      inputSchema: {
        network: mcpNftNetworkSchema.describe(`Network id; only ${MCP_NFT_NETWORKS.join(', ')} supported today.`),
      },
    },
    async ({ network }) => {
      mcpCallLog(`list_nfts: start - ${network}`);
      trackMcpCall(deps, 'list_nfts');
      try {
        const w = await backgroundCaller.lazyInitWallet(network, MCP_BALANCE_ACCOUNT_NUMBER);
        if (!walletCanHaveNfts(w)) {
          mcpCallLog(`list_nfts: error - wallet cannot hold NFTs (${network})`);
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: 'Wallet does not support NFTs on this network.', network }, null, 2) }],
          };
        }
        const owned = await w.fetchNfts();
        const nfts = owned.map((n) => ({
          contract_address: n.contractAddress,
          token_id: n.tokenId,
          name: n.name,
          collection_name: n.collectionName,
          description: n.description,
          image: n.image,
        }));
        mcpCallLog(`list_nfts: ok - ${network}, ${nfts.length} nft(s)`);
        showMcpSuccess(deps, `Listed NFTs (${network})`, `${nfts.length} item(s)`);
        return {
          content: [{ type: 'text', text: JSON.stringify({ network, nfts }, null, 2) }],
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        mcpCallLog(`list_nfts: error - ${network}: ${message}`);
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: message, network }, null, 2) }],
        };
      }
    }
  );

  mcp.registerTool(
    'transfer_nft',
    {
      title: 'Transfer NFT to an address',
      description: `Transfers the NFT identified by \`contract_address\` + \`token_id\` to \`receiver_address\`. \`network\` must be one of: ${MCP_NFT_NETWORKS.join(', ')}. Call list_nfts first; **pass \`contract_address\` and \`token_id\` exactly as returned** (verbatim strings from the tool output). Malformed or chat-transcribed ids will fail; use the exact values from MCP JSON, not a human summary.`,
      inputSchema: {
        network: mcpNftNetworkSchema.describe(`Network id; only ${MCP_NFT_NETWORKS.join(', ')} supported today.`),
        contract_address: z
          .string()
          .min(1)
          .describe('Exact `contract_address` from list_nfts for the same `network` — copy verbatim from tool output (no edits). Leading/trailing whitespace is trimmed only.'),
        token_id: z.string().min(1).describe('Exact `token_id` from list_nfts for the same `network` — copy verbatim from tool output (no edits). Leading/trailing whitespace is trimmed only.'),
        receiver_address: z.string().min(1).describe('Recipient address (Spark: spark1…; Stacks: SP… / ST… principal).'),
      },
    },
    async ({ network, contract_address, token_id, receiver_address }) => {
      const contract = contract_address.trim();
      const tid = token_id.trim();
      const addr = receiver_address.trim();
      mcpCallLog(`transfer_nft: start - ${network}, contract ${contract.slice(0, 12)}… token ${tid.slice(0, 12)}…`);
      trackMcpCall(deps, 'transfer_nft');

      if (network === NETWORK_SPARK && !isValidSparkAddress(addr)) {
        mcpCallLog(`transfer_nft: error - invalid Spark address`);
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: 'Invalid Spark receiver address.', network }, null, 2) }],
        };
      }
      if (network === NETWORK_STACKS && !validateAddress(NETWORK_STACKS, addr)) {
        mcpCallLog(`transfer_nft: error - invalid Stacks address`);
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: 'Invalid Stacks receiver address.', network }, null, 2) }],
        };
      }

      try {
        const w = await backgroundCaller.lazyInitWallet(network, MCP_BALANCE_ACCOUNT_NUMBER);
        if (!walletCanHaveNfts(w)) {
          mcpCallLog(`transfer_nft: error - no NFT support (${network})`);
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: 'Wallet does not support NFTs on this network.', network }, null, 2) }],
          };
        }

        const owned = await w.fetchNfts();
        const nft = owned.find((n) => n.contractAddress === contract && n.tokenId === tid);
        if (!nft) {
          mcpCallLog(`transfer_nft: error - NFT not owned on ${network}`);
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    error: 'NFT not found in this wallet. Run list_nfts and use the exact contract_address and token_id from that list.',
                    network,
                    contract_address: contract,
                    token_id: tid,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const transfer_id = await w.transferNFT(nft, addr);
        if (!transfer_id) {
          mcpCallLog('transfer_nft: error - empty transfer id');
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: 'Transfer did not return an id.', network }, null, 2) }],
          };
        }
        mcpCallLog(`transfer_nft: ok - ${network} ${transfer_id}`);
        showMcpSuccess(deps, `Sent NFT (${network})`, transfer_id.slice(0, 16));
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  network,
                  transfer_id,
                  contract_address: contract,
                  token_id: tid,
                  receiver_address: addr,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        mcpCallLog(`transfer_nft: error - ${network}: ${message}`);
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: message, network }, null, 2) }],
        };
      }
    }
  );

  mcp.registerTool(
    'get_btc_usd_rate',
    {
      title: 'Get BTC/USD exchange rate',
      description: 'Returns the spot Bitcoin price in US dollars (USD per 1 whole BTC)',
    },
    async () => {
      mcpCallLog('get_btc_usd_rate: start');
      trackMcpCall(deps, 'get_btc_usd_rate');
      try {
        const usdPerBtc = await exchangeRateFetcher({
          cacheKey: 'exchangeRateFetcher',
          network: NETWORK_BITCOIN,
          fiat: 'USD',
        });
        mcpCallLog(`get_btc_usd_rate: ok - ~$${usdPerBtc.toFixed(2)} per 1 BTC`);
        showMcpSuccess(deps, 'Fetched BTC/USD', `~$${usdPerBtc.toFixed(2)} / BTC`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  pair: 'BTC/USD',
                  quote: 'USD',
                  usd_per_btc: usdPerBtc,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        mcpCallLog(`get_btc_usd_rate: error - ${message}`);
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        };
      }
    }
  );

  mcp.registerTool(
    'create_lightning_invoice',
    {
      title: 'Create Lightning invoice (BOLT11)',
      description: `Creates a BOLT11 receive invoice on \`network\`: ${MCP_LIGHTNING_PAY_NETWORKS.join(',')} (same layers as pay_lightning_invoice). If \`network\` is omitted it defaults to \`${NETWORK_SPARK}\`. \`sats\` is the amount to request. Optional \`memo\` is the invoice description. Response includes the BOLT11 string in \`invoice\` and the BOLT11 payment hash in \`payment_hash\` (64 hex chars). Track payment status with \`is_invoice_paid\` using the \`payment_hash\`. Handle \`payment_hash\` extra carefully - it must be passed exactly - malformed/mangled strings will not work; dont rely on chat transcription, use EXACT values as returned by MCP.`,
      inputSchema: {
        sats: z.number().int().positive().describe('Requested amount in satoshis.'),
        memo: z.string().optional().describe('Optional description / memo on the invoice.'),
        network: mcpLightningPayNetworkSchema.optional().describe(`Wallet layer: ${MCP_LIGHTNING_PAY_NETWORKS.join(',')}. Defaults to \`${NETWORK_SPARK}\` when omitted.`),
      },
    },
    async ({ sats, memo, network: networkRaw }) => {
      const network = networkRaw ?? NETWORK_SPARK;
      mcpCallLog(`create_lightning_invoice: start - ${network}, ${sats} sats${memo?.trim() ? ' (' + memo?.trim() + ')' : ''}`);
      trackMcpCall(deps, 'create_lightning_invoice');
      try {
        const w = await backgroundCaller.lazyInitWallet(network, MCP_BALANCE_ACCOUNT_NUMBER);
        if (!walletSupportsLightning(w)) {
          mcpCallLog(`create_lightning_invoice: error - wallet has no Lightning receive on ${network}`);
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'Wallet does not support Lightning receive.', network }, null, 2),
              },
            ],
          };
        }

        const { invoice, serviceFeeSat } = await w.createLightningInvoice(sats, memo ?? 'Created by Layerz Wallet AI');
        const paymentHash = String(bolt11.decode(invoice).tags.find((t) => t.tagName === 'payment_hash')?.data ?? '');
        if (!paymentHash) throw new Error('payment_hash tag not found in BOLT11 invoice');
        mcpCallLog(`create_lightning_invoice: ok - ${network}, ${sats} sats, service fee ${serviceFeeSat} sats, invoice starts ${bolt11Preview(invoice)}, payment_hash ${paymentHash}`);
        showMcpSuccess(deps, 'Created Lightning invoice', `${memo ?? ''} ${network} · ${sats} sats`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  invoice,
                  payment_hash: paymentHash,
                  network,
                  sats,
                  ...(memo != null && memo !== '' ? { memo } : {}),
                  service_fee_sat: serviceFeeSat,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        mcpCallLog(`create_lightning_invoice: error - exception on ${network}: ${message}`);
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: message, network }, null, 2) }],
        };
      }
    }
  );

  mcp.registerTool(
    'is_invoice_paid',
    {
      title: 'Check if Lightning invoice is paid',
      description: `Returns whether an invoice that we created has been paid, looked up by its BOLT11 payment hash (the \`payment_hash\` field returned from \`create_lightning_invoice\`). Use the same network the invoice was created on (${MCP_LIGHTNING_PAY_NETWORKS.join(',')}).`,
      inputSchema: {
        payment_hash: z
          .string()
          .regex(/^[0-9a-fA-F]{64}$/, 'payment_hash must be 64 hex chars (the `payment_hash` field returned from create_lightning_invoice).')
          .describe('BOLT11 payment hash, 64-char hex string. Returned as `payment_hash` from create_lightning_invoice.'),
        network: mcpLightningPayNetworkSchema.describe(`Wallet layer: ${MCP_LIGHTNING_PAY_NETWORKS.join(',')}.`),
      },
    },
    async ({ payment_hash: paymentHashRaw, network }) => {
      const paymentHash = paymentHashRaw.trim().toLowerCase();
      mcpCallLog(`is_invoice_paid: start - ${network}, payment_hash ${paymentHash}`);
      trackMcpCall(deps, 'is_invoice_paid');

      showMcpSuccess(deps, 'Checking if Lightning invoice is paid');

      try {
        const w = await backgroundCaller.lazyInitWallet(network, MCP_BALANCE_ACCOUNT_NUMBER);
        if (!walletSupportsLightning(w)) {
          mcpCallLog(`is_invoice_paid: error - no Lightning support on ${network}`);
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'Wallet does not support Lightning.', network }, null, 2),
              },
            ],
          };
        }

        const paid = await w.isInvoicePaidByHash(paymentHash);
        mcpCallLog(`is_invoice_paid: ok - ${network}, paid=${paid}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ paid, network, payment_hash: paymentHash }, null, 2),
            },
          ],
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        mcpCallLog(`is_invoice_paid: error - exception on ${network}: ${message}`);
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: message, network }, null, 2) }],
        };
      }
    }
  );

  mcp.registerTool(
    'pay_lightning_invoice',
    {
      title: 'Pay Lightning invoice (slow; blocks until done)',
      description: `Pays a BOLT11 Lightning invoice from the given layer wallet. \`network\`: ${MCP_LIGHTNING_PAY_NETWORKS.join(',')}. Invoice: raw lnbc… or lightning:lnbc… URI. This tool blocks until the wallet finishes or errors — commonly 15–60s, sometimes 2m+. MCP clients must use a long HTTP read timeout (≥120s, ideally 180s+); a generic "fetch failed" / network error often means the client gave up while payment was still in flight, not necessarily that the wallet failed. Do not blindly retry the same invoice: it may have paid; check activity or ask the user before attempting again. To pay lightning address (e.g. "username@example.com") you must first resolve lightning address to a BOLT11 invoice using actual lightning address protocol, and then pay that invoice`,
      inputSchema: {
        invoice: z.string().min(1).describe('BOLT11 invoice (lnbc…) or lightning:lnbc… URI.'),
        network: mcpLightningPayNetworkSchema.describe(`Wallet layer: ${MCP_LIGHTNING_PAY_NETWORKS.join(',')}.`),
      },
    },
    async ({ invoice: invoiceRaw, network }) => {
      const invoice = normalizeBolt11Invoice(invoiceRaw);
      mcpCallLog(`pay_lightning_invoice: start - ${network}, invoice ${bolt11Preview(invoice)}`);
      trackMcpCall(deps, 'pay_lightning_invoice');
      showMcpSuccess(deps, 'Paying Lightning invoice...');

      try {
        const w = await backgroundCaller.lazyInitWallet(network, MCP_BALANCE_ACCOUNT_NUMBER);
        if (!walletSupportsLightning(w)) {
          mcpCallLog(`pay_lightning_invoice: error - no Lightning pay on ${network}`);
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'Wallet does not support Lightning payments.', network }, null, 2),
              },
            ],
          };
        }

        const ok = await w.payLightningInvoice(invoice, MCP_LIGHTNING_PAY_MAX_FEE_PERCENT);
        if (!ok) {
          mcpCallLog(`pay_lightning_invoice: error - payment did not complete on ${network}`);
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'Payment did not complete successfully.', network }, null, 2),
              },
            ],
          };
        }

        mcpCallLog(`pay_lightning_invoice: ok - paid on ${network}`);
        showMcpSuccess(deps, 'Paid Lightning invoice!', network);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, network, max_fee_percent: MCP_LIGHTNING_PAY_MAX_FEE_PERCENT }, null, 2),
            },
          ],
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        mcpCallLog(`pay_lightning_invoice: error - exception on ${network}: ${message}`);
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: message, network }, null, 2) }],
        };
      }
    }
  );

  mcp.registerTool(
    'get_lightning_address',
    {
      title: 'Get your Lightning Address',
      description: `Returns THIS wallet's own Lightning Address (Spark, \`name@${LAYERZ_ME_DOMAIN}\`). Anyone can pay you at this address from any Lightning wallet. If no human-readable username has been claimed, the address falls back to \`<spark-address>@${LAYERZ_ME_DOMAIN}\` — still fully payable; call \`claim_lightning_address\` to get a friendly \`name@${LAYERZ_ME_DOMAIN}\`. Read-only; no funds move.`,
    },
    async () => {
      mcpCallLog('get_lightning_address: start');
      trackMcpCall(deps, 'get_lightning_address');
      try {
        const sparkAddress = await backgroundCaller.getAddress(NETWORK_SPARK, MCP_BALANCE_ACCOUNT_NUMBER);
        const { lightningAddress, username, claimed } = await lookupLayerzLightningAddress(sparkAddress);
        mcpCallLog(`get_lightning_address: ok - ${lightningAddress}`);
        showMcpSuccess(deps, 'Lightning Address', lightningAddress);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  lightning_address: lightningAddress,
                  spark_address: sparkAddress,
                  username,
                  claimed,
                  domain: LAYERZ_ME_DOMAIN,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        mcpCallLog(`get_lightning_address: error - ${message}`);
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
        };
      }
    }
  );

  mcp.registerTool(
    'claim_lightning_address',
    {
      title: 'Claim a Lightning Address username',
      description: `Registers \`username\` so this wallet's Lightning Address becomes \`<username>@${LAYERZ_ME_DOMAIN}\` (Spark). The username is bound to your Spark address; pick something memorable. Fails if it is already taken. After claiming, \`get_lightning_address\` returns the new address. Publishes a public username — it does NOT move funds.`,
      inputSchema: {
        username: z.string().min(1).describe(`Desired username (the part before @${LAYERZ_ME_DOMAIN}). Trimmed and lowercased automatically; must be currently unused.`),
      },
    },
    async ({ username: usernameRaw }) => {
      mcpCallLog(`claim_lightning_address: start - "${usernameRaw.trim()}"`);
      trackMcpCall(deps, 'claim_lightning_address');
      try {
        const sparkAddress = await backgroundCaller.getAddress(NETWORK_SPARK, MCP_BALANCE_ACCOUNT_NUMBER);
        const claim = await claimLayerzLightningAddressUsername(sparkAddress, usernameRaw);
        if (!claim.ok) {
          let error: string;
          switch (claim.reason) {
            case 'empty':
              error = 'Username must not be empty.';
              break;
            case 'taken': {
              const username = usernameRaw.trim().toLowerCase();
              mcpCallLog(`claim_lightning_address: error - "${username}" already taken`);
              error = `Username "${username}" is unavailable.`;
              break;
            }
            case 'unconfirmed':
              mcpCallLog('claim_lightning_address: error - layerz.me did not confirm the claim');
              error = 'Unable to claim username.';
              break;
            case 'api_error':
              mcpCallLog(`claim_lightning_address: error - ${claim.message ?? 'layerz.me request failed'}`);
              error = claim.message ?? 'Unable to claim username.';
              break;
          }
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error }, null, 2) }],
          };
        }

        mcpCallLog(`claim_lightning_address: ok - ${claim.lightningAddress}`);
        showMcpSuccess(deps, `Claimed Lightning Address ${claim.lightningAddress}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  lightning_address: claim.lightningAddress,
                  username: claim.username,
                  spark_address: sparkAddress,
                  domain: LAYERZ_ME_DOMAIN,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        mcpCallLog(`claim_lightning_address: error - ${message}`);
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
        };
      }
    }
  );

  mcp.registerTool(
    'get_swap_quote',
    {
      title: 'Quote an in-wallet swap (no funds move)',
      description:
        'Returns a quote for swapping `send_amount_base_units` of `send_asset` into `receive_asset`. Currently only BTC↔USDB on Spark. The response includes a `quote_id` you must pass verbatim to `execute_swap` to actually trade. Quotes expire at `expires_at_unix` (typically 60s, TELL USER HOW MUCH TIME IS LEFT); call this tool again after expiry. **No funds move on this call** — it only stages the swap so the user/agent can review fees before committing.\n\n' +
        MCP_BASE_UNITS_GUIDANCE +
        '\n\n**Where `send_amount_base_units` comes from:** call `get_network_balance` on `spark` for `native:spark` (BTC/sats), or `list_tokens` on `spark` for `token:spark:usdb` — copy `balance_base_units` verbatim (or a smaller amount ≤ balance). The wallet converts base units → human amount internally; you must not multiply by `10^decimals` before calling this tool.\n\n' +
        '**Present the EXACT outcome to the user with zero mental math.** The response already contains both machine units (`*_base_units`) and ready-to-show decimal strings (`send_amount_human_readable`, `receive_amount_human_readable`); `receive_amount_*`, `effective_exchange_rate`, and `rate` are all already net of the AMM fee — quote them verbatim, do **NOT** subtract anything on top.\n\n' +
        '- `send_amount_human_readable` / `receive_amount_human_readable`: precomputed decimal strings (e.g. "0.001", "99.5") for the send and receive amounts. **Quote these verbatim to the user** (with the asset ticker); never divide a `*_base_units` value by `10^decimals` yourself — the wallet has already done the decimal math.\n' +
        '- `effective_exchange_rate`: precomputed BTC price in USDB the user is actually paying, factoring in fees (e.g. "99500.00"). Always normalized to USDB-per-BTC regardless of swap direction, so the user can compare it directly to a market BTC price. Prefer this over `rate` when presenting — `rate` reads poorly in the USDB→BTC direction ("1 USDB = 0.00001 BTC").\n' +
        '- `effective_fee_rate`: precomputed `fee_base_units / send_amount_base_units × 100` as a percent string. Always surface it for transparency about what the AMM is keeping — but show it as transparency, **not** as a further deduction on top of the rate/amounts.\n\n' +
        'Good: "You\'ll send 0.001 BTC and receive 99.5 USDB (effective price: 99,500 USDB per BTC, includes a 0.4% AMM fee)."\n' +
        'Bad: "You\'ll send 0.001 BTC at 99,500 USDB per BTC, with a 0.4% fee on top." (the fee is **not** on top — it\'s already baked into `effective_exchange_rate` and `receive_amount_base_units`.)',
      inputSchema: {
        send_asset: mcpSwapAssetSchema.describe(`Asset to sell. One of: ${MCP_SWAP_ASSET_IDS.join(', ')}.`),
        receive_asset: mcpSwapAssetSchema.describe(`Asset to buy. Must differ from \`send_asset\`. One of: ${MCP_SWAP_ASSET_IDS.join(', ')}.`),
        send_amount_base_units: mcpPositiveBaseUnitsString.describe(
          "Amount to sell in the send asset's smallest units (sats for native:spark, 6-decimal units for token:spark:usdb). Copy from balance_base_units — never multiply by 10^decimals."
        ),
      },
    },
    async ({ send_asset, receive_asset, send_amount_base_units }) => {
      mcpCallLog(`get_swap_quote: start - ${send_asset} -> ${receive_asset}, amount ${send_amount_base_units}`);
      trackMcpCall(deps, 'get_swap_quote');

      if (send_asset === receive_asset) {
        mcpCallLog('get_swap_quote: error - send_asset and receive_asset are the same');
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: '`send_asset` and `receive_asset` must differ.' }, null, 2) }],
        };
      }

      try {
        useTransferService(storage); // ensure the singleton + Flashnet service are constructed
        await backgroundCaller.lazyInitWallet(NETWORK_SPARK, MCP_BALANCE_ACCOUNT_NUMBER);
        setFlashnetAccountNumber(MCP_BALANCE_ACCOUNT_NUMBER);

        const manager = getTransferServiceManager();
        if (!manager) {
          mcpCallLog('get_swap_quote: error - transfer service manager not initialized');
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: 'Transfer service is not initialized yet. Open the wallet UI once, then retry.' }, null, 2) }],
          };
        }

        const sendInfo = getAssetInfo(send_asset);
        const receiveInfo = getAssetInfo(receive_asset);

        const sendAmountHuman = new BigNumber(send_amount_base_units).div(new BigNumber(10).pow(sendInfo.decimals)).toFixed();

        const quote = await manager.getQuote(send_asset, receive_asset, sendAmountHuman);
        // Stage in-memory only (5min TTL); execute_swap persists the completed row.
        const execution = await manager.executeTransfer(quote, MCP_BALANCE_ACCOUNT_NUMBER, '');

        const receiveAmountBaseUnits = new BigNumber(quote.receiveAmount).times(new BigNumber(10).pow(receiveInfo.decimals)).integerValue(BigNumber.ROUND_FLOOR).toFixed(0);

        // Human-readable decimal strings derived from the exact base-unit values we return, so the
        // two always agree. The agent must NOT recompute these — quote them verbatim to the user.
        const sendAmountHumanReadable = mcpBaseUnitsToHumanReadable(send_amount_base_units, sendInfo.decimals);
        const receiveAmountHumanReadable = mcpBaseUnitsToHumanReadable(receiveAmountBaseUnits, receiveInfo.decimals);

        // Trading fee as a percentage of the user's input (e.g. "0.4000" for 0.4%).
        // Kept as smallest-unit math (fee_base_units / send_amount_base_units) so it stays exact
        // regardless of asset decimals. `quote.rate` is already the post-fee effective rate,
        // since the AMM's amountOut is net of fees — surfacing this percentage lets the agent
        // explain the cost of the trade alongside that rate.
        const feeBaseUnitsStr = quote.feeBaseUnits ?? '0';
        const effectiveFeeRate = new BigNumber(feeBaseUnitsStr).div(new BigNumber(send_amount_base_units)).times(100).toFixed(4);

        // The actual BTC-priced-in-USDB rate the user is paying, factoring in fees.
        // `quote.rate` is direction-specific ("1 USDB = 0.00001 BTC" reads poorly), so we
        // always normalize to USDB-per-BTC for the BTC↔USDB pair. Uses human-unit amounts
        // — both sides are decimal-corrected, so the ratio is exact regardless of decimals.
        // If new swap pairs are added beyond MCP_SWAP_ASSET_IDS, revisit this normalization.
        const sendIsBtc = send_asset === 'native:spark';
        const usdbHuman = sendIsBtc ? quote.receiveAmount : sendAmountHuman;
        const btcHuman = sendIsBtc ? sendAmountHuman : quote.receiveAmount;
        const effectiveExchangeRate = new BigNumber(usdbHuman).div(new BigNumber(btcHuman)).toFixed(2);

        const summary = `${sendAmountHuman} ${sendInfo.ticker} \u2192 ${quote.receiveAmount} ${receiveInfo.ticker}`;
        mcpCallLog(
          `get_swap_quote: ok - ${summary}, price ${effectiveExchangeRate} USDB/BTC, fee ${feeBaseUnitsStr} ${quote.feeTicker} base units (${effectiveFeeRate}%), impact ${quote.priceImpactPct ?? '?'}%, quote_id ${execution.id}`
        );
        showMcpSuccess(deps, 'Quoted swap', summary);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  quote_id: execution.id,
                  send_asset,
                  receive_asset,
                  send_amount_base_units,
                  send_amount_human_readable: sendAmountHumanReadable,
                  receive_amount_base_units: receiveAmountBaseUnits,
                  receive_amount_human_readable: receiveAmountHumanReadable,
                  fee_base_units: feeBaseUnitsStr,
                  fee_asset: send_asset,
                  fee_ticker: quote.feeTicker,
                  effective_fee_rate: effectiveFeeRate,
                  effective_exchange_rate: effectiveExchangeRate,
                  price_impact_pct: quote.priceImpactPct ?? '0',
                  rate: quote.rate,
                  estimated_time_seconds: quote.estimatedTime,
                  expires_at_unix: quote.expiresAt,
                  service: quote.serviceName,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        mcpCallLog(`get_swap_quote: error - ${message}`);
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
        };
      }
    }
  );

  mcp.registerTool(
    'execute_swap',
    {
      title: 'Execute a previously quoted swap',
      description:
        'Executes the swap staged by an earlier `get_swap_quote` call. Pass `quote_id` exactly as returned. The trade is atomic (a few seconds, no on-chain confirmations on Spark) and **irreversible** once it returns success. Each `quote_id` can only be executed **once**; expired or already-executed quotes return an error and you must re-quote. Slippage is capped at 3% (300 bps); execution fails rather than filling beyond that.\n\nThe response returns both `*_base_units` and ready-to-show `send_amount_human_readable` / `receive_amount_human_readable` decimal strings — **quote the human-readable values verbatim** to the user; never divide base units by `10^decimals` yourself.',
      inputSchema: {
        quote_id: z.string().min(1).describe('Exact `quote_id` from `get_swap_quote` — copy verbatim. Leading/trailing whitespace is trimmed.'),
      },
    },
    async ({ quote_id }) => {
      const qid = quote_id.trim();
      mcpCallLog(`execute_swap: start - quote_id ${qid}`);
      trackMcpCall(deps, 'execute_swap');

      try {
        const manager = getTransferServiceManager();
        if (!manager) {
          mcpCallLog('execute_swap: error - transfer service not initialized');
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: 'Transfer service is not initialized yet. Call `get_swap_quote` first from a warm wallet.' }, null, 2) }],
          };
        }

        // Re-pin Flashnet at the MCP account in case other code mutated it between quote and execute.
        // No-op for non-Flashnet quotes (setFlashnetAccountNumber only touches the Flashnet singleton).
        setFlashnetAccountNumber(MCP_BALANCE_ACCOUNT_NUMBER);

        const completed = await manager.executeInstantSwap(qid);
        await manager.commitTransfer(completed);

        if (completed.type !== EXECUTION_INSTANT) {
          throw new Error(`Unexpected execution type for swap: ${completed.type}`);
        }

        const sendInfo = getAssetInfo(completed.sendAsset);
        const receiveInfo = getAssetInfo(completed.receiveAsset);
        const receiveBaseUnits = new BigNumber(completed.receiveAmount).times(new BigNumber(10).pow(receiveInfo.decimals)).integerValue(BigNumber.ROUND_FLOOR).toFixed(0);
        const sendBaseUnits = new BigNumber(completed.sendAmount).times(new BigNumber(10).pow(sendInfo.decimals)).integerValue(BigNumber.ROUND_FLOOR).toFixed(0);
        const sendAmountHumanReadable = mcpBaseUnitsToHumanReadable(sendBaseUnits, sendInfo.decimals);
        const receiveAmountHumanReadable = mcpBaseUnitsToHumanReadable(receiveBaseUnits, receiveInfo.decimals);
        const summary = `${completed.sendAmount} ${sendInfo.ticker} \u2192 ${completed.receiveAmount} ${receiveInfo.ticker}`;

        mcpCallLog(`execute_swap: ok - ${summary}`);
        showMcpSuccess(deps, 'Swapped', summary);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  quote_id: qid,
                  send_asset: completed.sendAsset,
                  receive_asset: completed.receiveAsset,
                  send_amount_base_units: sendBaseUnits,
                  send_amount_human_readable: sendAmountHumanReadable,
                  receive_amount_base_units: receiveBaseUnits,
                  receive_amount_human_readable: receiveAmountHumanReadable,
                  service: completed.serviceName,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        mcpCallLog(`execute_swap: error - ${message}`);
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: message, quote_id: qid }, null, 2) }],
        };
      }
    }
  );
}
