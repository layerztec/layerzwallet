/**
 * Tests the two Lightning-Address MCP tools: `get_lightning_address` and `claim_lightning_address`.
 *
 * A Layerz Lightning Address is Spark + layerz.me only. The default address is always
 * `<spark-address>@layerz.me` (payable immediately, no claim). "Claiming" registers a human
 * username via the layerz.me SparkHub HTTP API (`GET /api/users/{username}` availability check →
 * `POST /api/users {username, sparkAddress}`), after which the address becomes `<username>@layerz.me`.
 * This is exactly what the mobile `ClaimUsernameModal` / `ReceiveOnLightningAddress` screens do — no
 * new wallet/SDK method is involved, so we mock the generated layerz.me client + `getAddress`.
 *
 * These tests pin:
 *  - get: claimed-username address, default fallback when no username is claimed, SOFT fallback to
 *    the default address when the layerz.me lookup throws (must NOT error), and a hard error when
 *    `getAddress` itself fails.
 *  - claim: trim+lowercase of the username, availability check then POST with the wallet's spark
 *    address, success toast/tracking, "already taken" rejection (without POSTing), empty-after-trim
 *    rejection (without hitting the API), a POST response lacking a username, and an API failure
 *    surfacing as an MCP error (not a throw) with no success toast.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MCP_BALANCE_ACCOUNT_NUMBER } from '../../hooks/AccountNumberContext';
import { registerWalletMcpCalls } from '../../features/mcp/modules/mcp-calls';
import type { McpCallDeps } from '../../features/mcp/modules/mcp-deps';
import { NETWORK_SPARK } from '../../types/networks';

// Heavy module graph pulled in at import time by mcp-calls.ts — stub it so the surface stays
// cheap and deterministic (mirrors the other mcp-calls unit tests).
vi.mock('@flashnet/sdk', () => ({ FlashnetClient: vi.fn(), isFlashnetError: vi.fn().mockReturnValue(false) }));
vi.mock('@buildonspark/spark-sdk', () => ({ isValidSparkAddress: vi.fn().mockReturnValue(true) }));
vi.mock('../../hooks/useTransferService', () => ({ useTransferService: vi.fn(), getTransferServiceManager: vi.fn(), setFlashnetAccountNumber: vi.fn() }));
vi.mock('../../hooks/useExchangeRate', () => ({ exchangeRateFetcher: vi.fn() }));
vi.mock('../../hooks/useBalance', () => ({ balanceFetcher: vi.fn() }));
vi.mock('../../hooks/useTokenBalance', () => ({ tokenBalanceFetcher: vi.fn() }));
vi.mock('../../features/mcp/modules/mcp-activity-log', () => ({ pushMcpActivityLog: vi.fn() }));
vi.mock('../../modules/wallet-utils', () => ({ validateAddress: vi.fn().mockReturnValue(true) }));

// The layerz.me SparkHub client — the only thing the two tools talk to (besides `getAddress`).
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
  const fakeServer = {
    registerTool: vi.fn((name: string, _config: unknown, handler: ToolHandler) => {
      handlers.set(name, handler);
    }),
  };
  registerWalletMcpCalls(fakeServer as any, deps);
  return handlers;
}

describe('MCP get_lightning_address', () => {
  let deps: McpCallDeps;
  let handlers: Map<string, ToolHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockReturnValue({ __client: true });
    mockGetAddress.mockResolvedValue(SPARK_ADDRESS);
    deps = makeFakeDeps();
    handlers = buildHandlers(deps);
  });

  it('returns the claimed username address when a username is registered for this spark address', async () => {
    mockGetBySparkAddress.mockResolvedValueOnce({ data: { status: 'ok', username: 'alice', sparkAddress: SPARK_ADDRESS } });

    const result = await handlers.get('get_lightning_address')!({});

    expect(result.isError).toBeUndefined();
    const body = parseToolJson(result);
    expect(body.lightning_address).toBe('alice@layerz.me');
    expect(body.spark_address).toBe(SPARK_ADDRESS);
    expect(body.username).toBe('alice');
    expect(body.claimed).toBe(true);
    expect(body.domain).toBe('layerz.me');

    expect(mockGetAddress).toHaveBeenCalledWith(NETWORK_SPARK, MCP_BALANCE_ACCOUNT_NUMBER);
    expect(mockGetBySparkAddress).toHaveBeenCalledTimes(1);
    expect(deps.trackToolCall).toHaveBeenCalledWith('get_lightning_address');
    // Like every other read tool (get_network_balance / get_receive_address / …), a successful read
    // pushes to the activity log and fires the toast so it shows up in the calls-log component.
    expect(deps.showSuccessToast).toHaveBeenCalledTimes(1);
  });

  it('falls back to the default <spark-address>@layerz.me when no username is claimed', async () => {
    mockGetBySparkAddress.mockResolvedValueOnce({ data: { status: 'not_found' } });

    const result = await handlers.get('get_lightning_address')!({});

    expect(result.isError).toBeUndefined();
    const body = parseToolJson(result);
    expect(body.lightning_address).toBe(`${SPARK_ADDRESS}@layerz.me`);
    expect(body.username).toBeNull();
    expect(body.claimed).toBe(false);
  });

  it('SOFT-falls back to the default address when the layerz.me lookup throws (does not error)', async () => {
    mockGetBySparkAddress.mockRejectedValueOnce(new Error('layerz.me 500'));

    const result = await handlers.get('get_lightning_address')!({});

    expect(result.isError).toBeUndefined();
    const body = parseToolJson(result);
    expect(body.lightning_address).toBe(`${SPARK_ADDRESS}@layerz.me`);
    expect(body.username).toBeNull();
    expect(body.claimed).toBe(false);
  });

  it('surfaces a getAddress failure as an MCP error (not a throw)', async () => {
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
    mockCreateClient.mockReturnValue({ __client: true });
    mockGetAddress.mockResolvedValue(SPARK_ADDRESS);
    // Default: username is available.
    mockGetByUsername.mockResolvedValue({ data: { status: 'not_found' } });
    mockPostUsers.mockResolvedValue({ data: { status: 'ok', message: 'created', username: 'alice', sparkAddress: SPARK_ADDRESS } });
    deps = makeFakeDeps();
    handlers = buildHandlers(deps);
  });

  it('claims an available username (trim+lowercase) and binds it to the wallet spark address', async () => {
    const result = await handlers.get('claim_lightning_address')!({ username: '  Alice ' });

    expect(result.isError).toBeUndefined();
    const body = parseToolJson(result);
    expect(body.success).toBe(true);
    expect(body.lightning_address).toBe('alice@layerz.me');
    expect(body.username).toBe('alice');
    expect(body.spark_address).toBe(SPARK_ADDRESS);
    expect(body.domain).toBe('layerz.me');

    expect(mockGetByUsername).toHaveBeenCalledWith(expect.objectContaining({ path: { username: 'alice' } }));
    expect(mockPostUsers).toHaveBeenCalledWith(expect.objectContaining({ body: { username: 'alice', sparkAddress: SPARK_ADDRESS } }));

    expect(deps.trackToolCall).toHaveBeenCalledWith('claim_lightning_address');
    expect(deps.showSuccessToast).toHaveBeenCalledTimes(1);
  });

  it('rejects a username that is already taken, without POSTing', async () => {
    mockGetByUsername.mockResolvedValueOnce({ data: { status: 'ok', username: 'alice', sparkAddress: 'spark1someoneelse00000000000000000000000' } });

    const result = await handlers.get('claim_lightning_address')!({ username: 'alice' });

    expect(result.isError).toBe(true);
    expect(parseToolJson(result).error).toMatch(/unavailable|taken/i);
    expect(mockPostUsers).not.toHaveBeenCalled();
    expect(deps.showSuccessToast).not.toHaveBeenCalled();
  });

  it('rejects an empty/whitespace username without hitting the API', async () => {
    const result = await handlers.get('claim_lightning_address')!({ username: '   ' });

    expect(result.isError).toBe(true);
    expect(parseToolJson(result).error).toMatch(/username/i);
    expect(mockGetByUsername).not.toHaveBeenCalled();
    expect(mockPostUsers).not.toHaveBeenCalled();
  });

  it('treats a POST response without a username as an error', async () => {
    mockPostUsers.mockResolvedValueOnce({ data: { status: 'error', message: 'something' } });

    const result = await handlers.get('claim_lightning_address')!({ username: 'alice' });

    expect(result.isError).toBe(true);
    expect(parseToolJson(result).error).toMatch(/unable to claim/i);
    expect(deps.showSuccessToast).not.toHaveBeenCalled();
  });

  it('surfaces a layerz.me POST failure as an MCP error (not a throw)', async () => {
    mockPostUsers.mockRejectedValueOnce(new Error('layerz.me unavailable'));

    const result = await handlers.get('claim_lightning_address')!({ username: 'alice' });

    expect(result.isError).toBe(true);
    expect(parseToolJson(result).error).toMatch(/layerz\.me unavailable/i);
    expect(deps.showSuccessToast).not.toHaveBeenCalled();
  });
});
