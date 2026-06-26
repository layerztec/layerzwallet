/**
 * MCP wiring for lightning-address tools only. Business logic lives in
 * `modules/layerz-lightning-address.ts` — tested there, not re-tested here.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MCP_BALANCE_ACCOUNT_NUMBER } from '../../hooks/AccountNumberContext';
import { registerWalletMcpCalls } from '../../features/mcp/modules/mcp-calls';
import type { McpCallDeps } from '../../features/mcp/modules/mcp-deps';
import { NETWORK_SPARK } from '../../types/networks';

vi.mock('@flashnet/sdk', () => ({ FlashnetClient: vi.fn(), isFlashnetError: vi.fn().mockReturnValue(false) }));
vi.mock('@buildonspark/spark-sdk', () => ({ isValidSparkAddress: vi.fn().mockReturnValue(true) }));
vi.mock('../../hooks/useTransferService', () => ({ useTransferService: vi.fn(), getTransferServiceManager: vi.fn(), setFlashnetAccountNumber: vi.fn() }));
vi.mock('../../hooks/useExchangeRate', () => ({ exchangeRateFetcher: vi.fn() }));
vi.mock('../../hooks/useBalance', () => ({ balanceFetcher: vi.fn() }));
vi.mock('../../hooks/useTokenBalance', () => ({ tokenBalanceFetcher: vi.fn() }));
vi.mock('../../features/mcp/modules/mcp-activity-log', () => ({ pushMcpActivityLog: vi.fn() }));
vi.mock('../../modules/wallet-utils', () => ({ validateAddress: vi.fn().mockReturnValue(true) }));

const { mockGetByUsername, mockGetBySparkAddress, mockPostUsers, mockCreateClient } = vi.hoisted(() => ({
  mockGetByUsername: vi.fn(),
  mockGetBySparkAddress: vi.fn(),
  mockPostUsers: vi.fn(),
  mockCreateClient: vi.fn(),
}));
vi.mock('../../openapi/generated/layerzme', () => ({
  getApiUsersByUsername: mockGetByUsername,
  getApiUsersBySparkAddressBySparkAddress: mockGetBySparkAddress,
  postApiUsers: mockPostUsers,
}));
vi.mock('../../openapi/generated/layerzme/client', () => ({ createClient: mockCreateClient }));

type ToolHandler = (input: any) => Promise<{ content: { text: string }[]; isError?: boolean }>;

function parseToolJson(result: { content: { text: string }[] }): any {
  return JSON.parse(result.content[0].text);
}

const SPARK_ADDRESS = 'spark1exampleownaddress000000000000000000';
const mockGetAddress = vi.fn();

function makeFakeDeps(): McpCallDeps {
  return {
    storage: {} as any,
    backgroundCaller: { getAddress: mockGetAddress, lazyInitWallet: vi.fn() } as any,
    showSuccessToast: vi.fn(),
    trackToolCall: vi.fn(),
  };
}

function buildHandlers(deps: McpCallDeps): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();
  registerWalletMcpCalls({ registerTool: vi.fn((name: string, _config: unknown, handler: ToolHandler) => handlers.set(name, handler)) } as any, deps);
  return handlers;
}

describe('MCP get_lightning_address', () => {
  let deps: McpCallDeps;
  let handlers: Map<string, ToolHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockReturnValue({});
    mockGetAddress.mockResolvedValue(SPARK_ADDRESS);
    mockGetBySparkAddress.mockResolvedValue({ data: { username: 'alice' } });
    deps = makeFakeDeps();
    handlers = buildHandlers(deps);
  });

  it('loads the spark address from the wallet and returns MCP JSON', async () => {
    const result = await handlers.get('get_lightning_address')!({});

    expect(result.isError).toBeUndefined();
    expect(parseToolJson(result)).toMatchObject({
      lightning_address: 'alice@layerz.me',
      spark_address: SPARK_ADDRESS,
      domain: 'layerz.me',
    });
    expect(mockGetAddress).toHaveBeenCalledWith(NETWORK_SPARK, MCP_BALANCE_ACCOUNT_NUMBER);
    expect(deps.trackToolCall).toHaveBeenCalledWith('get_lightning_address');
    expect(deps.showSuccessToast).toHaveBeenCalledTimes(1);
  });

  it('does not call layerz.me when getAddress fails', async () => {
    mockGetAddress.mockRejectedValueOnce(new Error('wallet not ready'));

    const result = await handlers.get('get_lightning_address')!({});

    expect(result.isError).toBe(true);
    expect(parseToolJson(result).error).toMatch(/wallet not ready/i);
    expect(mockGetBySparkAddress).not.toHaveBeenCalled();
  });
});

describe('MCP claim_lightning_address', () => {
  let deps: McpCallDeps;
  let handlers: Map<string, ToolHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockReturnValue({});
    mockGetAddress.mockResolvedValue(SPARK_ADDRESS);
    mockGetByUsername.mockResolvedValue({ data: { status: 'not_found' } });
    mockPostUsers.mockResolvedValue({ data: { username: 'alice', sparkAddress: SPARK_ADDRESS } });
    deps = makeFakeDeps();
    handlers = buildHandlers(deps);
  });

  it('returns success JSON and toast after a successful claim', async () => {
    const result = await handlers.get('claim_lightning_address')!({ username: 'alice' });

    expect(result.isError).toBeUndefined();
    expect(parseToolJson(result)).toMatchObject({ success: true, username: 'alice', spark_address: SPARK_ADDRESS });
    expect(mockGetAddress).toHaveBeenCalledWith(NETWORK_SPARK, MCP_BALANCE_ACCOUNT_NUMBER);
    expect(deps.trackToolCall).toHaveBeenCalledWith('claim_lightning_address');
    expect(deps.showSuccessToast).toHaveBeenCalledTimes(1);
  });

  it('maps module empty-input failure to an MCP error without calling the API', async () => {
    const result = await handlers.get('claim_lightning_address')!({ username: '   ' });

    expect(result.isError).toBe(true);
    expect(parseToolJson(result).error).toMatch(/empty/i);
    expect(mockGetByUsername).not.toHaveBeenCalled();
    expect(deps.showSuccessToast).not.toHaveBeenCalled();
  });
});
