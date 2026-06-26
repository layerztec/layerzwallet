/**
 * Tests the EVM branch of the MCP `transfer_token` tool.
 *
 * EVM wallets don't implement `InterfaceCanHaveTokens`. The handler instead mirrors the app's
 * manual EVM token-send screen (mobile `SendTokenEvm.tsx`): the low-level
 * `createTokenTransferTransaction → prepareTransaction (with the fee multiplier) →
 * signTransaction → broadcastTransaction` path, signing with `backgroundCaller.getMasterSeed()`.
 *
 * These tests pin: the EVM path is one-step (no confirmation), passes the `fee_multiplier`
 * (default 1) through to `prepareTransaction`, broadcasts on the dedicated MCP account, blocks
 * on insufficient balance / invalid address, surfaces RPC errors as MCP errors (not throws),
 * and that a non-EVM network (spark) still takes the legacy `transferToken` path.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MCP_BALANCE_ACCOUNT_NUMBER } from '../../hooks/AccountNumberContext';
import { registerWalletMcpCalls } from '../../features/mcp/modules/mcp-calls';
import type { McpCallDeps } from '../../features/mcp/modules/mcp-deps';
import { getTickerByNetwork } from '../../models/network-getters';
import { NETWORK_ROOTSTOCK, NETWORK_SPARK } from '../../types/networks';

// Heavy module graph pulled in at import time by mcp-calls.ts — stub it so the surface stays
// cheap and deterministic (mirrors mcp-calls-receive-address.test.ts).
vi.mock('@flashnet/sdk', () => ({ FlashnetClient: vi.fn(), isFlashnetError: vi.fn().mockReturnValue(false) }));
vi.mock('@buildonspark/spark-sdk', () => ({ isValidSparkAddress: vi.fn().mockReturnValue(true) }));
vi.mock('../../hooks/useTransferService', () => ({ useTransferService: vi.fn(), getTransferServiceManager: vi.fn(), setFlashnetAccountNumber: vi.fn() }));
vi.mock('../../hooks/useExchangeRate', () => ({ exchangeRateFetcher: vi.fn() }));
vi.mock('../../hooks/useBalance', () => ({ balanceFetcher: vi.fn() }));
vi.mock('../../features/mcp/modules/mcp-activity-log', () => ({ pushMcpActivityLog: vi.fn() }));

// Hoisted spies so the (pre-body) vi.mock factories can reference them.
const { mockTokenBalanceFetcher } = vi.hoisted(() => ({ mockTokenBalanceFetcher: vi.fn() }));
vi.mock('../../hooks/useTokenBalance', () => ({ tokenBalanceFetcher: mockTokenBalanceFetcher }));

const { mockCreateTokenTransfer, mockGetFeeData, mockPrepareTransaction, mockGetBaseFeePerGas, mockCalculateMinFee, mockSignTransaction, mockBroadcastTransaction, mockIsAddressValid } = vi.hoisted(
  () => ({
    mockCreateTokenTransfer: vi.fn(),
    mockGetFeeData: vi.fn(),
    mockPrepareTransaction: vi.fn(),
    mockGetBaseFeePerGas: vi.fn(),
    mockCalculateMinFee: vi.fn(),
    mockSignTransaction: vi.fn(),
    mockBroadcastTransaction: vi.fn(),
    mockIsAddressValid: vi.fn(),
  })
);
vi.mock('../../class/evm-wallet', () => {
  class EvmWallet {
    network: unknown;
    createTokenTransferTransaction = mockCreateTokenTransfer;
    getFeeData = mockGetFeeData;
    prepareTransaction = mockPrepareTransaction;
    getBaseFeePerGas = mockGetBaseFeePerGas;
    calculateMinFee = mockCalculateMinFee;
    signTransaction = mockSignTransaction;
    broadcastTransaction = mockBroadcastTransaction;
    static isAddressValid = mockIsAddressValid;
  }
  return { EvmWallet };
});

type ToolHandler = (input: any) => Promise<{ content: { text: string }[]; isError?: boolean }>;

function parseToolJson(result: { content: { text: string }[] }): any {
  return JSON.parse(result.content[0].text);
}

const getAddress = vi.fn(async () => '0xFromAddressForMcpPocket0000000000000000');
const getMasterSeed = vi.fn(async () => 'test test test test test test test test test test test junk');
const lazyInitWallet = vi.fn(async () => ({
  transferToken: vi.fn(),
  fetchTokenBalances: vi.fn(),
  getTokenBalances: vi.fn(() => []),
  _lastTokensFetch: 0,
}));

function makeFakeDeps(): McpCallDeps {
  return {
    storage: {} as any,
    backgroundCaller: { getAddress, getMasterSeed, lazyInitWallet } as any,
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

// Real curated Rootstock token (chainId 30) so getTokenInfo resolves without mocking token-list.
const RBTC_TOKEN = '0xEf213441a85DF4d7acBdAe0Cf78004E1e486BB96';
const EVM_RECIPIENT = '0xRecipientEvmAddress00000000000000000000';

describe('MCP transfer_token (EVM branch)', () => {
  let handlers: Map<string, ToolHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAddressValid.mockReturnValue(true);
    mockTokenBalanceFetcher.mockResolvedValue('1000000000000000000000'); // plenty
    mockCreateTokenTransfer.mockResolvedValue({ data: '0xerc20transfercalldata', from: '0xfrom', to: RBTC_TOKEN });
    mockGetFeeData.mockResolvedValue({ maxFeePerGas: 2n, maxPriorityFeePerGas: 1n });
    mockPrepareTransaction.mockResolvedValue({ gasLimit: 60000 });
    mockGetBaseFeePerGas.mockResolvedValue(0n);
    mockCalculateMinFee.mockReturnValue('12345');
    mockSignTransaction.mockResolvedValue('0xsignedrawtx');
    mockBroadcastTransaction.mockResolvedValue('0xbroadcasttxhash');
    handlers = buildHandlers(makeFakeDeps());
  });

  it('sends an ERC-20 in one step via the UI path (default fee_multiplier 1), then broadcasts', async () => {
    const result = await handlers.get('transfer_token')!({
      network: NETWORK_ROOTSTOCK,
      token_id: `  ${RBTC_TOKEN}  `,
      amount_base_units: '1000000',
      receiver_address: `  ${EVM_RECIPIENT}  `,
    });

    expect(result.isError).toBeUndefined();
    const body = parseToolJson(result);
    expect(body.success).toBe(true);
    expect(body.network).toBe(NETWORK_ROOTSTOCK);
    expect(body.transfer_id).toBe('0xbroadcasttxhash');
    expect(body.token_id).toBe(RBTC_TOKEN); // trimmed
    expect(body.receiver_address).toBe(EVM_RECIPIENT); // trimmed
    expect(body.fee_base_units).toBe('12345');
    expect(body.fee_human_readable).toBe('0.000000000000012345'); // fee in native RBTC (18 decimals)
    expect(typeof body.amount_human_readable).toBe('string'); // amount in token decimals
    expect(typeof body.amount_ticker).toBe('string'); // token symbol
    expect(body.fee_ticker).toBe(getTickerByNetwork(NETWORK_ROOTSTOCK));
    expect(body.fee_multiplier).toBe(1);

    // Built from trimmed inputs, amount passed in base units verbatim (no decimal scaling).
    expect(getAddress).toHaveBeenCalledWith(NETWORK_ROOTSTOCK, MCP_BALANCE_ACCOUNT_NUMBER);
    expect(mockCreateTokenTransfer).toHaveBeenCalledWith('0xFromAddressForMcpPocket0000000000000000', EVM_RECIPIENT, expect.objectContaining({ id: RBTC_TOKEN }), '1000000');
    // fee multiplier flows into prepareTransaction's overpayMultiplier (default 1n).
    expect(mockPrepareTransaction).toHaveBeenCalledWith(expect.anything(), NETWORK_ROOTSTOCK, expect.anything(), 1n);
    // One-step: signs with the master seed on the MCP account, then broadcasts.
    expect(getMasterSeed).toHaveBeenCalledTimes(1);
    expect(mockSignTransaction).toHaveBeenCalledWith(expect.anything(), 'test test test test test test test test test test test junk', MCP_BALANCE_ACCOUNT_NUMBER);
    expect(mockBroadcastTransaction).toHaveBeenCalledWith(NETWORK_ROOTSTOCK, '0xsignedrawtx');
  });

  it('passes a supplied fee_multiplier through to prepareTransaction', async () => {
    const result = await handlers.get('transfer_token')!({
      network: NETWORK_ROOTSTOCK,
      token_id: RBTC_TOKEN,
      amount_base_units: '5',
      receiver_address: EVM_RECIPIENT,
      fee_multiplier: 3,
    });

    expect(result.isError).toBeUndefined();
    expect(parseToolJson(result).fee_multiplier).toBe(3);
    expect(mockPrepareTransaction).toHaveBeenCalledWith(expect.anything(), NETWORK_ROOTSTOCK, expect.anything(), 3n);
  });

  it('rejects an invalid EVM receiver address without preparing or broadcasting', async () => {
    mockIsAddressValid.mockReturnValue(false);

    const result = await handlers.get('transfer_token')!({
      network: NETWORK_ROOTSTOCK,
      token_id: RBTC_TOKEN,
      amount_base_units: '5',
      receiver_address: 'not-an-address',
    });

    expect(result.isError).toBe(true);
    expect(parseToolJson(result).error).toMatch(/invalid evm receiver address/i);
    expect(mockCreateTokenTransfer).not.toHaveBeenCalled();
    expect(getMasterSeed).not.toHaveBeenCalled();
    expect(mockBroadcastTransaction).not.toHaveBeenCalled();
  });

  it('blocks a transfer that exceeds the token balance (no broadcast)', async () => {
    mockTokenBalanceFetcher.mockResolvedValueOnce('5');

    const result = await handlers.get('transfer_token')!({
      network: NETWORK_ROOTSTOCK,
      token_id: RBTC_TOKEN,
      amount_base_units: '1000000',
      receiver_address: EVM_RECIPIENT,
    });

    expect(result.isError).toBe(true);
    const body = parseToolJson(result);
    expect(body.error).toMatch(/insufficient token balance/i);
    expect(body.balance_base_units).toBe('5');
    expect(mockBroadcastTransaction).not.toHaveBeenCalled();
    expect(getMasterSeed).not.toHaveBeenCalled();
  });

  it('surfaces a broadcast/RPC failure as an MCP error, not a throw', async () => {
    mockBroadcastTransaction.mockRejectedValueOnce(new Error('insufficient funds for gas'));

    const result = await handlers.get('transfer_token')!({
      network: NETWORK_ROOTSTOCK,
      token_id: RBTC_TOKEN,
      amount_base_units: '1000000',
      receiver_address: EVM_RECIPIENT,
    });

    expect(result.isError).toBe(true);
    const body = parseToolJson(result);
    expect(body.error).toBe('insufficient funds for gas');
    expect(body.network).toBe(NETWORK_ROOTSTOCK);
  });

  it('does NOT take the EVM path for a non-EVM network (spark routes through transferToken)', async () => {
    await handlers.get('transfer_token')!({
      network: NETWORK_SPARK,
      token_id: 'btkn1sometoken',
      amount_base_units: '5',
      receiver_address: 'spark1somerecipient',
    });

    // EVM pipeline untouched; legacy account-based path was used.
    expect(mockCreateTokenTransfer).not.toHaveBeenCalled();
    expect(mockBroadcastTransaction).not.toHaveBeenCalled();
    expect(lazyInitWallet).toHaveBeenCalledWith(NETWORK_SPARK, MCP_BALANCE_ACCOUNT_NUMBER);
  });
});
