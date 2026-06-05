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

import { EvmWallet } from '../../../class/evm-wallet';
import { BreezWallet } from '../../../class/wallets/breez-wallet';
import { walletCanHaveNfts } from '../../../class/wallets/interface-can-have-nfts';
import { walletCanHaveTokens } from '../../../class/wallets/interface-can-have-tokens';
import { walletSupportsLightning } from '../../../class/wallets/interface-lightning-wallet';
import { MCP_BALANCE_ACCOUNT_NUMBER } from '../../../hooks/AccountNumberContext';
import { exchangeRateFetcher } from '../../../hooks/useExchangeRate';
import { balanceFetcher } from '../../../hooks/useBalance';
import { tokenBalanceFetcher } from '../../../hooks/useTokenBalance';
import { getTransferServiceManager, setFlashnetAccountNumber, useTransferService } from '../../../hooks/useTransferService';
import { getAssetInfo } from '../../../models/asset-info';
import { getDecimalsByNetwork, getIsEVM, getIsTestnet, getTickerByNetwork } from '../../../models/network-getters';
import { getTokenInfo, getTokenList } from '../../../models/token-list';
import { validateAddress, type TSupportedLazyInitWalletNetworks } from '../../../modules/wallet-utils';
import { AssetId } from '../../../types/asset';
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
import { EXECUTION_INSTANT } from '../../../types/transfer';

import { pushMcpActivityLog } from './mcp-activity-log';
import { MCP_LIGHTNING_PAY_MAX_FEE_PERCENT } from './mcp-constants';
import type { McpCallDeps } from './mcp-deps';
import { MCP_BASE_UNITS_GUIDANCE } from './mcp-instructions';

function mcpCallLog(line: string): void {
  console.log('[mcp-call] ' + line);
}

function bolt11Preview(bolt: string, max = 28): string {
  const t = bolt.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
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
 * mainnet network that ships a curated token list (EVM L2s like Rootstock/Botanix, plus Liquid),
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
 * Networks `transfer_native` can send the chain's native coin on (e.g. RBTC on Rootstock,
 * cBTC on Citrea). Generic across networks — extended per-network as branches are added to the
 * handler. Today only EVM mainnets are wired up (they need no curated token list, just the
 * chain's gas coin, and reuse the UI coin-send path: `createPaymentTransaction →
 * prepareTransaction → signTransaction → broadcastTransaction`). Derived so new networks are
 * picked up automatically once their handler branch lands.
 */
const MCP_NATIVE_TRANSFER_NETWORKS: Networks[] = mcpListableNetworks().filter((n) => getIsEVM(n));
const mcpNativeTransferNetworkSchema = z.enum(MCP_NATIVE_TRANSFER_NETWORKS as [Networks, ...Networks[]]);

/** Max EVM fee "speed up" multiplier exposed to MCP. */
const MCP_EVM_FEE_MULTIPLIER_MAX = 5;

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
        'Returns `balance_base_units` (smallest units), `ticker`, and `decimals`. Use the `network` id exactly as returned by list_networks.\n\n' +
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
        'Address format varies per network — Bitcoin: bc1…; EVM chains (rootstock, botanix, citrea): 0x… (the same address works across all EVM chains); Liquid: lq1…/VJL…; Spark: spark1…; Stacks: SP… principal. ' +
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
        `Returns fungible tokens (not NFTs) you currently hold (non-zero balance), each with \`balance_base_units\` (smallest units), \`decimals\`, \`symbol\`, and \`token_id\`. Refreshes balances first. \`network\` must be one of: ${MCP_TOKEN_READ_NETWORKS.join(', ')}.\n\n` +
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
        let tokens: Array<{ token_id: string; name: string; symbol: string; decimals: number; balance_base_units: string }>;

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
          tokens = w.getTokenBalances().map((t) => ({
            token_id: t.id,
            name: t.name,
            symbol: t.symbol,
            decimals: t.decimals,
            balance_base_units: t.balance ?? '0',
          }));
        } else {
          // EVM/Liquid have no on-chain token discovery: enumerate the curated token list and
          // query each balance (ERC20 balanceOf / Breez asset balances), keeping only held tokens.
          const candidates = getTokenList(net);
          const balances = await Promise.all(
            candidates.map((t) => tokenBalanceFetcher({ cacheKey: 'mcpListTokens', accountNumber: MCP_BALANCE_ACCOUNT_NUMBER, network: net, tokenContractAddress: t.id, backgroundCaller }))
          );
          tokens = candidates
            .map((t, i) => ({
              token_id: t.id,
              name: t.name,
              symbol: t.symbol,
              decimals: t.decimals,
              balance_base_units: balances[i] ?? '0',
            }))
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
                { type: 'text', text: JSON.stringify({ error: 'Insufficient token balance.', network: net, token_id: tid, amount_base_units, balance_base_units: tokenBalance ?? '0' }, null, 2) },
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
                { type: 'text', text: JSON.stringify({ error: 'Insufficient token balance.', network: net, token_id: tid, amount_base_units, balance_base_units: tokenBalance ?? '0' }, null, 2) },
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
                    balance_base_units: holding.balance ?? '0',
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
                  { error: `Insufficient ${getTickerByNetwork(net)} balance for amount + gas.`, network: net, amount_base_units, fee_base_units: fee, balance_base_units: nativeBalance ?? '0' },
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
      description: `Creates a BOLT11 receive invoice on \`network\`: ${MCP_LIGHTNING_PAY_NETWORKS.join(',')} (same layers as pay_lightning_invoice). \`sats\` is the amount to request. Optional \`memo\` is the invoice description. Response includes the bolt11 string in \`invoice\`. Handle \`invoice\` extra carefully - it must be passed exactly - malformed/mangled invoices will not work; dont rely on chat transcription, use EXACT values as returned by MCP.`,
      inputSchema: {
        sats: z.number().int().positive().describe('Requested amount in satoshis.'),
        memo: z.string().optional().describe('Optional description / memo on the invoice.'),
        network: mcpLightningPayNetworkSchema.describe(`Wallet layer: ${MCP_LIGHTNING_PAY_NETWORKS.join(',')}.`),
      },
    },
    async ({ sats, memo, network }) => {
      mcpCallLog(`create_lightning_invoice: start - ${network}, ${sats} sats${memo?.trim() ? ', memo set' : ''}`);
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

        const { invoice, serviceFeeSat } = await w.createLightningInvoice(sats, memo ?? '');
        mcpCallLog(`create_lightning_invoice: ok - ${network}, ${sats} sats, service fee ${serviceFeeSat} sats, invoice starts ${bolt11Preview(invoice)}`);
        showMcpSuccess(deps, 'Created Lightning invoice', `${memo ?? ''} ${network} · ${sats} sats`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  invoice,
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
      description: `Returns whether the given BOLT11 invoice that we created has been paid, as seen by this wallet on \`network\` (${MCP_LIGHTNING_PAY_NETWORKS.join(',')}). Use the same network the invoice was created on.`,
      inputSchema: {
        invoice: z.string().min(1).describe('BOLT11 invoice (lnbc…) or lightning:lnbc… URI.'),
        network: mcpLightningPayNetworkSchema.describe(`Wallet layer: ${MCP_LIGHTNING_PAY_NETWORKS.join(',')}.`),
      },
    },
    async ({ invoice: invoiceRaw, network }) => {
      const invoice = normalizeBolt11Invoice(invoiceRaw);
      mcpCallLog(`is_invoice_paid: start - ${network}, invoice ${bolt11Preview(invoice)}`);
      trackMcpCall(deps, 'is_invoice_paid');

      try {
        bolt11.decode(invoice);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        mcpCallLog(`is_invoice_paid: error - invalid BOLT11: ${message}`);
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: `Invalid BOLT11 invoice: ${message}`, network }, null, 2),
            },
          ],
        };
      }

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

        const paid = await w.isInvoicePaid(invoice);
        mcpCallLog(`is_invoice_paid: ok - ${network}, paid=${paid}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ paid, network }, null, 2),
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
    'get_swap_quote',
    {
      title: 'Quote an in-wallet swap (no funds move)',
      description:
        'Returns a quote for swapping `send_amount_base_units` of `send_asset` into `receive_asset`. Currently only BTC↔USDB on Spark. The response includes a `quote_id` you must pass verbatim to `execute_swap` to actually trade. Quotes expire at `expires_at_unix` (typically 60s, TELL USER HOW MUCH TIME IS LEFT); call this tool again after expiry. **No funds move on this call** — it only stages the swap so the user/agent can review fees before committing.\n\n' +
        MCP_BASE_UNITS_GUIDANCE +
        '\n\n**Where `send_amount_base_units` comes from:** call `get_network_balance` on `spark` for `native:spark` (BTC/sats), or `list_tokens` on `spark` for `token:spark:usdb` — copy `balance_base_units` verbatim (or a smaller amount ≤ balance). The wallet converts base units → human amount internally; you must not multiply by `10^decimals` before calling this tool.\n\n' +
        '**Present the EXACT outcome to the user with zero mental math.** `receive_amount_base_units`, `effective_exchange_rate`, and `rate` are all already net of the AMM fee — quote them verbatim, do **NOT** subtract anything on top.\n\n' +
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
                  receive_amount_base_units: receiveAmountBaseUnits,
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
        'Executes the swap staged by an earlier `get_swap_quote` call. Pass `quote_id` exactly as returned. The trade is atomic (a few seconds, no on-chain confirmations on Spark) and **irreversible** once it returns success. Each `quote_id` can only be executed **once**; expired or already-executed quotes return an error and you must re-quote. Slippage is capped at 3% (300 bps); execution fails rather than filling beyond that.',
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
                  receive_amount_base_units: receiveBaseUnits,
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
