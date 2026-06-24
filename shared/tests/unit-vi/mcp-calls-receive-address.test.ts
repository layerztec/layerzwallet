/**
 * Tests the MCP `get_receive_address` tool. The wallet exposes a single unified
 * `backgroundCaller.getAddress(network, accountNumber)` that already covers every
 * network the app lists (bitcoin on-chain, EVM chains, Liquid, Spark, Stacks).
 *
 * These tests pin the parity contract: `get_receive_address` must return an address
 * for EVERY network that `list_networks` returns (not just the account-based ones),
 * delegate to `getAddress` for the MCP pocket, and reject anything that isn't a
 * listable mainnet network without touching the wallet.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MCP_BALANCE_ACCOUNT_NUMBER } from '../../hooks/AccountNumberContext';
import { registerWalletMcpCalls } from '../../features/mcp/modules/mcp-calls';
import type { McpCallDeps } from '../../features/mcp/modules/mcp-deps';
import { getTickerByNetwork } from '../../models/network-getters';
import { NETWORK_ARK, NETWORK_BITCOIN, NETWORK_ROOTSTOCK, NETWORK_CITREA, NETWORK_LIQUID, NETWORK_SPARK, NETWORK_STACKS, type Networks } from '../../types/networks';

// mcp-calls.ts imports the transfer-service + rate/balance fetchers at module load.
// get_receive_address uses none of them, but we stub the heavy graph so importing
// the MCP surface stays cheap and deterministic (mirrors mcp-calls-swap.test.ts).
vi.mock('@flashnet/sdk', () => ({ FlashnetClient: vi.fn(), isFlashnetError: vi.fn().mockReturnValue(false) }));
vi.mock('../../hooks/useTransferService', () => ({ useTransferService: vi.fn(), getTransferServiceManager: vi.fn(), setFlashnetAccountNumber: vi.fn() }));
vi.mock('../../hooks/useExchangeRate', () => ({ exchangeRateFetcher: vi.fn() }));
vi.mock('../../hooks/useBalance', () => ({ balanceFetcher: vi.fn() }));
vi.mock('../../features/mcp/modules/mcp-activity-log', () => ({ pushMcpActivityLog: vi.fn() }));

type ToolHandler = (input: any) => Promise<{ content: { text: string }[]; isError?: boolean }>;

function parseToolJson(result: { content: { text: string }[] }): any {
  return JSON.parse(result.content[0].text);
}

/** Deterministic per-network address so we can assert pure pass-through. */
const ADDRESS_BY_NETWORK: Record<string, string> = {
  [NETWORK_BITCOIN]: 'bc1qexamplebitcoinreceiveaddr0000000000',
  [NETWORK_ROOTSTOCK]: '0xRootstockEvmReceiveAddress0000000000000',
  [NETWORK_CITREA]: '0xCitreaEvmReceiveAddress000000000000000',
  [NETWORK_LIQUID]: 'lq1qliquidexamplereceiveaddress000000000',
  [NETWORK_SPARK]: 'spark1exampleoffchainreceiveaddress0000',
  [NETWORK_ARK]: 'ark1exampleoffchainreceiveaddress000000',
  [NETWORK_STACKS]: 'SP2EXAMPLESTACKSPRINCIPALADDRESS0000000',
};

const getAddress = vi.fn(async (network: Networks, _accountNumber: number) => ADDRESS_BY_NETWORK[network] ?? `addr-${network}`);

function makeFakeDeps(): McpCallDeps {
  return {
    storage: {} as any,
    backgroundCaller: { getAddress } as any,
    showSuccessToast: vi.fn(),
    trackToolCall: vi.fn(),
  };
}

function buildHandlers(deps: McpCallDeps): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();
  const fakeServer = {
    registerTool: vi.fn((name: string, _config: unknown, handler: ToolHandler) => {
      handlers.set(name, handler);
    }),
  };
  registerWalletMcpCalls(fakeServer as any, deps);
  return handlers;
}

describe('MCP get_receive_address', () => {
  let handlers: Map<string, ToolHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = buildHandlers(makeFakeDeps());
  });

  // The whole point of this change: parity with the app's Receive flow for every listable network.
  const LISTABLE_NETWORKS: Networks[] = [NETWORK_BITCOIN, NETWORK_ROOTSTOCK, NETWORK_CITREA, NETWORK_LIQUID, NETWORK_SPARK, NETWORK_ARK, NETWORK_STACKS];

  it.each(LISTABLE_NETWORKS)('returns the receive address for %s via the unified getAddress', async (network) => {
    const result = await handlers.get('get_receive_address')!({ network });

    expect(result.isError).toBeUndefined();
    const body = parseToolJson(result);
    expect(body.network).toBe(network);
    expect(body.ticker).toBe(getTickerByNetwork(network));
    expect(body.address).toBe(ADDRESS_BY_NETWORK[network]);

    // Always resolved against the dedicated MCP pocket, never the user's selected account.
    expect(getAddress).toHaveBeenCalledWith(network, MCP_BALANCE_ACCOUNT_NUMBER);
  });

  it('rejects a non-listable network (lightning/usdt/testnet) without touching the wallet', async () => {
    for (const bad of ['lightning', 'USDT', 'liquid_testnet', 'ark_mutinynet', 'dogecoin']) {
      const result = await handlers.get('get_receive_address')!({ network: bad });
      expect(result.isError).toBe(true);
      const body = parseToolJson(result);
      expect(body.error).toMatch(/network/i);
    }
    expect(getAddress).not.toHaveBeenCalled();
  });

  it('surfaces a wallet error (e.g. SDK not ready) as an MCP error, not a throw', async () => {
    getAddress.mockRejectedValueOnce(new Error('Breez SDK not initialized'));

    const result = await handlers.get('get_receive_address')!({ network: NETWORK_LIQUID });

    expect(result.isError).toBe(true);
    const body = parseToolJson(result);
    expect(body.error).toBe('Breez SDK not initialized');
    expect(body.network).toBe(NETWORK_LIQUID);
  });
});
