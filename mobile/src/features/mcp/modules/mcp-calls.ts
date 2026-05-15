/**
 * Wallet MCP surface — add or change tools / call behaviour here.
 * No HTTP, tunnel, or session lifecycle (that stays in `mcp.ts`).
 */

import BigNumber from 'bignumber.js';
import * as bolt11 from 'bolt11';
import { isValidSparkAddress } from '@buildonspark/spark-sdk';
import * as z from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import Toast from 'react-native-toast-message';

import { walletCanHaveNfts } from '@shared/class/wallets/interface-can-have-nfts';
import { walletCanHaveTokens } from '@shared/class/wallets/interface-can-have-tokens';
import { walletSupportsLightning } from '@shared/class/wallets/interface-lightning-wallet';
import { exchangeRateFetcher } from '@shared/hooks/useExchangeRate';
import { balanceFetcher } from '@shared/hooks/useBalance';
import { getTransferServiceManager, setFlashnetAccountNumber, useTransferService } from '@shared/hooks/useTransferService';
import { getAssetInfo } from '@shared/models/asset-info';
import { getDecimalsByNetwork, getIsTestnet, getTickerByNetwork } from '@shared/models/network-getters';
import { validateAddress } from '@shared/modules/wallet-utils';
import { AssetId } from '@shared/types/asset';
import {
  getAvailableNetworks,
  NETWORK_ARK,
  NETWORK_BITCOIN,
  NETWORK_LIGHTNING,
  NETWORK_LIGHTNING_TESTNET,
  NETWORK_LIQUID,
  NETWORK_SPARK,
  NETWORK_STACKS,
  NETWORK_USDT,
  type Networks,
} from '@shared/types/networks';
import { EXECUTION_INSTANT } from '@shared/types/transfer';

import { LayerzStorage } from '@/src/class/layerz-storage';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { AnalyticsEvents, trackAnalyticsEvent } from '@/src/modules/analytics';

import { pushMcpActivityLog } from './mcp-activity-log';
import { MCP_BALANCE_ACCOUNT_NUMBER, MCP_LIGHTNING_PAY_MAX_FEE_PERCENT } from './mcp-constants';

function mcpCallLog(line: string): void {
  console.log('[mcp-call] ' + line);
}

function trackMcpCall(toolName: string): void {
  trackAnalyticsEvent(AnalyticsEvents.McpCall, { tool_name: toolName });
}

function bolt11Preview(bolt: string, max = 28): string {
  const t = bolt.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

/** Networks whose lazy-init wallet can pay BOLT11 Lightning invoices. */
const MCP_LIGHTNING_PAY_NETWORKS = [NETWORK_SPARK, NETWORK_ARK, NETWORK_LIQUID] as const;

const mcpLightningPayNetworkSchema = z.enum(MCP_LIGHTNING_PAY_NETWORKS);

/** Mainnet-style networks exposed to MCP (no testnets, Lightning, or USDT). */
function mcpListableNetworks(): Networks[] {
  return getAvailableNetworks().filter((n) => !getIsTestnet(n) && n !== NETWORK_LIGHTNING && n !== NETWORK_LIGHTNING_TESTNET && n !== NETWORK_USDT);
}

/** Positive integer string for token amounts in smallest units (no precision loss). */
const mcpPositiveBaseUnitsString = z.string().regex(/^[1-9]\d*$/, 'Must be a positive integer string in smallest token units (no decimals), e.g. "1000000".');

/** Networks supported by list_tokens / transfer_token. */
const MCP_TOKEN_NETWORKS = [NETWORK_SPARK, NETWORK_ARK, NETWORK_STACKS] as const;
const mcpTokenNetworkSchema = z.enum(MCP_TOKEN_NETWORKS);

/** Networks supported by list_nfts / transfer_nft. */
const MCP_NFT_NETWORKS = [NETWORK_SPARK, NETWORK_STACKS] as const;
const mcpNftNetworkSchema = z.enum(MCP_NFT_NETWORKS);

/** Networks supported by get_receive_address (account-based wallets exposed to MCP). */
const MCP_RECEIVE_ADDRESS_NETWORKS = [NETWORK_SPARK, NETWORK_STACKS, NETWORK_ARK] as const;
const mcpReceiveAddressNetworkSchema = z.enum(MCP_RECEIVE_ADDRESS_NETWORKS);

/**
 * AssetIds the MCP swap tools accept. Today: only BTC↔USDB on Spark (Flashnet AMM).
 * Adding more pairs is purely additive: extend this list and the routing falls through
 * to whatever provider TransferServiceManager picks.
 */
const MCP_SWAP_ASSET_IDS = ['native:spark', 'token:spark:usdb'] as const satisfies readonly AssetId[];
const mcpSwapAssetSchema = z.enum(MCP_SWAP_ASSET_IDS);

function walletHasOffchainReceiveAddress(w: unknown): w is { getOffchainReceiveAddress(): Promise<string> } {
  return typeof w === 'object' && w !== null && typeof (w as { getOffchainReceiveAddress?: unknown }).getOffchainReceiveAddress === 'function';
}

function normalizeBolt11Invoice(raw: string): string {
  const t = raw.trim();
  const lower = t.toLowerCase();
  if (lower.startsWith('lightning:')) {
    return t.slice('lightning:'.length).trim();
  }
  return t;
}

function showMcpSuccessToast(actionSummary: string, detail?: string): void {
  pushMcpActivityLog(actionSummary);
  Toast.show({
    type: 'mcpAiSuccess',
    text1: `AI action: ${actionSummary}`,
    ...(detail ? { text2: detail } : {}),
    position: 'top',
    visibilityTime: 5500,
  });
}

export function registerWalletMcpCalls(mcp: McpServer): void {
  mcp.registerTool(
    'list_networks',
    {
      title: 'List available Bitcoin networks',
      description: 'Returns mainnet networks supported by this wallet',
    },
    async () => {
      mcpCallLog('list_networks: start');
      trackMcpCall('list_networks');
      const networks = mcpListableNetworks();
      mcpCallLog(`list_networks: ok - ${networks.length} network(s): ${networks.join(', ')}`);
      showMcpSuccessToast('Listed networks', `${networks.length} network(s)`);
      return {
        content: [{ type: 'text', text: JSON.stringify({ networks }, null, 2) }],
      };
    }
  );

  mcp.registerTool(
    'get_network_balance',
    {
      title: 'Get balance for a network',
      description: 'Returns `balance_base_units` (smallest units), ticker, and decimals. Use the `network` id exactly as returned by list_networks.',
      inputSchema: {
        network: z.string().min(1).describe('Network id from list_networks, e.g. bitcoin, arkade, liquid.'),
      },
    },
    async ({ network: networkName }) => {
      const trimmed = networkName.trim();
      mcpCallLog(`get_network_balance: start - network=${trimmed}`);
      trackMcpCall('get_network_balance');
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
          backgroundCaller: BackgroundExecutor,
        });
        const ticker = getTickerByNetwork(network);
        const decimals = getDecimalsByNetwork(network);
        mcpCallLog(`get_network_balance: ok - ${network} (${ticker}), balance ${balance != null ? 'fetched' : 'null'}`);
        showMcpSuccessToast('Fetched balance for ' + network);
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
      description: `Returns the wallet's receive address for \`network\`. Use this when the user wants to receive funds on-chain (Spark address, Stacks principal, or Arkade ark1… address). Supported networks: ${MCP_RECEIVE_ADDRESS_NETWORKS.join(', ')}. Address format varies per network (Spark: spark1…; Stacks: SP…; Arkade: ark1…); pass it back to senders verbatim.`,
      inputSchema: {
        network: mcpReceiveAddressNetworkSchema.describe(`Network id; one of: ${MCP_RECEIVE_ADDRESS_NETWORKS.join(', ')}.`),
      },
    },
    async ({ network }) => {
      mcpCallLog(`get_receive_address: start - ${network}`);
      trackMcpCall('get_receive_address');
      try {
        const w = await BackgroundExecutor.lazyInitWallet(network, MCP_BALANCE_ACCOUNT_NUMBER);
        if (!walletHasOffchainReceiveAddress(w)) {
          mcpCallLog(`get_receive_address: error - wallet has no receive address on ${network}`);
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: 'Wallet does not expose a receive address on this network.', network }, null, 2) }],
          };
        }
        const address = await w.getOffchainReceiveAddress();
        const ticker = getTickerByNetwork(network);
        mcpCallLog(`get_receive_address: ok - ${network} (${ticker}), ${address.slice(0, 16)}…`);
        showMcpSuccessToast(`Receive address (${network})`, address.slice(0, 12) + '…');
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
      description: `Returns fungible tokens (not NFTs) with balance in smallest units (\`balance_base_units\` string), decimals, symbol, and \`token_id\`. Refreshes balances first. \`network\` must be one of: ${MCP_TOKEN_NETWORKS.join(', ')}. **Each \`token_id\` in the response must be copied exactly** (same string, character-for-character) into \`transfer_token\`; do not shorten, reformat, or infer from name/symbol.`,
      inputSchema: {
        network: mcpTokenNetworkSchema.describe(`Network id; only ${MCP_TOKEN_NETWORKS.join(', ')} supported today.`),
      },
    },
    async ({ network }) => {
      mcpCallLog(`list_tokens: start - ${network}`);
      trackMcpCall('list_tokens');
      try {
        await balanceFetcher({
          cacheKey: 'mcpListTokens',
          accountNumber: MCP_BALANCE_ACCOUNT_NUMBER,
          network,
          backgroundCaller: BackgroundExecutor,
        });
        const w = await BackgroundExecutor.lazyInitWallet(network, MCP_BALANCE_ACCOUNT_NUMBER);
        if (!walletCanHaveTokens(w)) {
          mcpCallLog(`list_tokens: error - wallet cannot hold tokens (${network})`);
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: 'Wallet does not expose token balances for this network.', network }, null, 2) }],
          };
        }
        if (network === NETWORK_STACKS) {
          await w.fetchTokenBalances();
        }
        const tokens = w.getTokenBalances().map((t) => ({
          token_id: t.id,
          name: t.name,
          symbol: t.symbol,
          decimals: t.decimals,
          balance_base_units: t.balance ?? '0',
        }));
        mcpCallLog(`list_tokens: ok - ${network}, ${tokens.length} token(s)`);
        showMcpSuccessToast(`Listed tokens (${network})`, `${tokens.length} token(s)`);
        return {
          content: [{ type: 'text', text: JSON.stringify({ network, tokens }, null, 2) }],
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
      description: `Sends \`amount_base_units\` (smallest units, integer string — same as list_tokens \`balance_base_units\`) of \`token_id\` to \`receiver_address\`. \`network\` must be one of: ${MCP_TOKEN_NETWORKS.join(', ')}. Call list_tokens first; **pass \`token_id\` exactly as returned** (verbatim string from the tool output). Malformed or chat-transcribed ids will fail; use the exact value from MCP JSON, not a human summary.`,
      inputSchema: {
        network: mcpTokenNetworkSchema.describe(`Network id; only ${MCP_TOKEN_NETWORKS.join(', ')} supported today.`),
        token_id: z
          .string()
          .min(1)
          .describe('Exact `token_id` string from list_tokens for the same `network` — copy verbatim from tool output (no edits). Leading/trailing whitespace is trimmed only.'),
        amount_base_units: mcpPositiveBaseUnitsString.describe('Amount to send in smallest token units (positive integer string).'),
        receiver_address: z.string().min(1).describe('Recipient address (Spark: spark1…; Arkade: ark1…; Stacks: SP… / ST… principal).'),
      },
    },
    async ({ network, token_id, amount_base_units, receiver_address }) => {
      const tid = token_id.trim();
      const addr = receiver_address.trim();
      mcpCallLog(`transfer_token: start - ${network}, token ${tid.slice(0, 12)}… amount ${amount_base_units}`);
      trackMcpCall('transfer_token');
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
      if (network === NETWORK_ARK && !validateAddress(NETWORK_ARK, addr)) {
        mcpCallLog(`transfer_token: error - invalid Arkade address`);
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: 'Invalid Arkade receiver address.', network }, null, 2) }],
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
      if (network === NETWORK_ARK && amount > BigInt(Number.MAX_SAFE_INTEGER)) {
        mcpCallLog(`transfer_token: error - amount exceeds Arkade wallet limit`);
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: `Amount exceeds maximum supported for Arkade transfers (${Number.MAX_SAFE_INTEGER} base units). Send a smaller amount or split the transfer.`,
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
          network,
          backgroundCaller: BackgroundExecutor,
        });
        const w = await BackgroundExecutor.lazyInitWallet(network, MCP_BALANCE_ACCOUNT_NUMBER);
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
        showMcpSuccessToast(`Sent token (${network})`, transfer_id.slice(0, 16));
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
      trackMcpCall('list_nfts');
      try {
        const w = await BackgroundExecutor.lazyInitWallet(network, MCP_BALANCE_ACCOUNT_NUMBER);
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
        showMcpSuccessToast(`Listed NFTs (${network})`, `${nfts.length} item(s)`);
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
      trackMcpCall('transfer_nft');

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
        const w = await BackgroundExecutor.lazyInitWallet(network, MCP_BALANCE_ACCOUNT_NUMBER);
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
        showMcpSuccessToast(`Sent NFT (${network})`, transfer_id.slice(0, 16));
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
      trackMcpCall('get_btc_usd_rate');
      try {
        const usdPerBtc = await exchangeRateFetcher({
          cacheKey: 'exchangeRateFetcher',
          network: NETWORK_BITCOIN,
          fiat: 'USD',
        });
        mcpCallLog(`get_btc_usd_rate: ok - ~$${usdPerBtc.toFixed(2)} per 1 BTC`);
        showMcpSuccessToast('Fetched BTC/USD', `~$${usdPerBtc.toFixed(2)} / BTC`);
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
      description: `Creates a BOLT11 receive invoice on \`network\`: ${MCP_LIGHTNING_PAY_NETWORKS.join(',')} (same layers as pay_lightning_invoice). \`sats\` is the amount to request. Arkade requires **more than 333 sats**. Optional \`memo\` is the invoice description. Response includes the bolt11 string in \`invoice\`. Handle \`invoice\` extra carefully - it must be passed exactly - malformed/mangled invoices will not work; dont rely on chat transcription, use EXACT values as returned by MCP.`,
      inputSchema: {
        sats: z.number().int().positive().describe('Requested amount in satoshis.'),
        memo: z.string().optional().describe('Optional description / memo on the invoice.'),
        network: mcpLightningPayNetworkSchema.describe(`Wallet layer: ${MCP_LIGHTNING_PAY_NETWORKS.join(',')}.`),
      },
    },
    async ({ sats, memo, network }) => {
      mcpCallLog(`create_lightning_invoice: start - ${network}, ${sats} sats${memo?.trim() ? ', memo set' : ''}`);
      trackMcpCall('create_lightning_invoice');
      try {
        if (network === NETWORK_ARK && sats <= 333) {
          mcpCallLog(`create_lightning_invoice: error - Arkade needs >333 sats (got ${sats})`);
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'Arkade Lightning invoices must be greater than 333 sats.', network, sats }, null, 2),
              },
            ],
          };
        }

        const w = await BackgroundExecutor.lazyInitWallet(network, MCP_BALANCE_ACCOUNT_NUMBER);
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
        showMcpSuccessToast('Created Lightning invoice', `${memo ?? ''} ${network} · ${sats} sats`);
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
      trackMcpCall('is_invoice_paid');

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

      showMcpSuccessToast('Checking if Lightning invoice is paid');

      try {
        const w = await BackgroundExecutor.lazyInitWallet(network, MCP_BALANCE_ACCOUNT_NUMBER);
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
      trackMcpCall('pay_lightning_invoice');
      showMcpSuccessToast('Paying Lightning invoice...');

      try {
        const w = await BackgroundExecutor.lazyInitWallet(network, MCP_BALANCE_ACCOUNT_NUMBER);
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
        showMcpSuccessToast('Paid Lightning invoice!', network);
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
        '**Present the EXACT outcome to the user with zero mental math.** `receive_amount_base_units`, `effective_exchange_rate`, and `rate` are all already net of the AMM fee — quote them verbatim, do **NOT** subtract anything on top.\n\n' +
        '- `effective_exchange_rate`: precomputed BTC price in USDB the user is actually paying, factoring in fees (e.g. "99500.00"). Always normalized to USDB-per-BTC regardless of swap direction, so the user can compare it directly to a market BTC price. Prefer this over `rate` when presenting — `rate` reads poorly in the USDB→BTC direction ("1 USDB = 0.00001 BTC").\n' +
        '- `effective_fee_rate`: precomputed `fee_base_units / send_amount_base_units × 100` as a percent string. Always surface it for transparency about what the AMM is keeping — but show it as transparency, **not** as a further deduction on top of the rate/amounts.\n\n' +
        'Good: "You\'ll send 0.001 BTC and receive 99.5 USDB (effective price: 99,500 USDB per BTC, includes a 0.4% AMM fee)."\n' +
        'Bad: "You\'ll send 0.001 BTC at 99,500 USDB per BTC, with a 0.4% fee on top." (the fee is **not** on top — it\'s already baked into `effective_exchange_rate` and `receive_amount_base_units`.)',
      inputSchema: {
        send_asset: mcpSwapAssetSchema.describe(`Asset to sell. One of: ${MCP_SWAP_ASSET_IDS.join(', ')}.`),
        receive_asset: mcpSwapAssetSchema.describe(`Asset to buy. Must differ from \`send_asset\`. One of: ${MCP_SWAP_ASSET_IDS.join(', ')}.`),
        send_amount_base_units: mcpPositiveBaseUnitsString.describe("Amount to sell, in the send asset's smallest units (sats for BTC, 6-decimal base units for USDB)."),
      },
    },
    async ({ send_asset, receive_asset, send_amount_base_units }) => {
      mcpCallLog(`get_swap_quote: start - ${send_asset} -> ${receive_asset}, amount ${send_amount_base_units}`);
      trackMcpCall('get_swap_quote');

      if (send_asset === receive_asset) {
        mcpCallLog('get_swap_quote: error - send_asset and receive_asset are the same');
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: '`send_asset` and `receive_asset` must differ.' }, null, 2) }],
        };
      }

      try {
        useTransferService(LayerzStorage); // ensure the singleton + Flashnet service are constructed
        await BackgroundExecutor.lazyInitWallet(NETWORK_SPARK, MCP_BALANCE_ACCOUNT_NUMBER);
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
        showMcpSuccessToast('Quoted swap', summary);

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
      trackMcpCall('execute_swap');

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
        showMcpSuccessToast('Swapped', summary);

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
