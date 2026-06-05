/**
 * Tests the MCP `transfer_native` tool for EVM networks (rootstock, botanix, citrea).
 *
 * EVM wallets are stateless and don't implement any token interface for the native coin. The
 * handler mirrors the app's manual EVM coin-send screen / the EVM branch of `transfer_token`:
 * the low-level `createPaymentTransaction → prepareTransaction → signTransaction →
 * broadcastTransaction` path, feeding the optional `fee_multiplier` into `prepareTransaction`'s
 * `overpayMultiplier`. No quote/confirm step.
 *
 * These tests pin: a one-step native send, the `fee_multiplier` flowing into `prepareTransaction`,
 * a balance pre-flight that requires `amount + gas`, address validation, input trimming, the MCP
 * pocket account number, and that wallet/RPC errors surface as MCP errors (not throws).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MCP_BALANCE_ACCOUNT_NUMBER } from '../../hooks/AccountNumberContext';
import { registerWalletMcpCalls } from '../../features/mcp/modules/mcp-calls';
import type { McpCallDeps } from '../../features/mcp/modules/mcp-deps';
import { getTickerByNetwork } from '../../models/network-getters';
import { NETWORK_ROOTSTOCK, NETWORK_BOTANIX, NETWORK_CITREA } from '../../types/networks';

// Heavy module graph pulled in at import time by mcp-calls.ts — stub it so the surface stays
// cheap and deterministic (mirrors mcp-calls-receive-address.test.ts).
vi.mock('@flashnet/sdk', () => ({ FlashnetClient: vi.fn(), isFlashnetError: vi.fn().mockReturnValue(false) }));
vi.mock('@buildonspark/spark-sdk', () => ({ isValidSparkAddress: vi.fn().mockReturnValue(true) }));
vi.mock('../../hooks/useTransferService', () => ({ useTransferService: vi.fn(), getTransferServiceManager: vi.fn(), setFlashnetAccountNumber: vi.fn() }));
vi.mock('../../hooks/useExchangeRate', () => ({ exchangeRateFetcher: vi.fn() }));
vi.mock('../../features/mcp/modules/mcp-activity-log', () => ({ pushMcpActivityLog: vi.fn() }));

// Hoisted spies so the (pre-body) vi.mock factories can reference them.
const { mockBalanceFetcher } = vi.hoisted(() => ({ mockBalanceFetcher: vi.fn() }));
vi.mock('../../hooks/useBalance', () => ({ balanceFetcher: mockBalanceFetcher }));

const { mockTokenBalanceFetcher } = vi.hoisted(() => ({ mockTokenBalanceFetcher: vi.fn() }));
vi.mock('../../hooks/useTokenBalance', () => ({ tokenBalanceFetcher: mockTokenBalanceFetcher }));

const { mockCreatePaymentTransaction, mockGetFeeData, mockPrepareTransaction, mockGetBaseFeePerGas, mockCalculateMinFee, mockSignTransaction, mockBroadcastTransaction, mockIsAddressValid } =
  vi.hoisted(() => ({
    mockCreatePaymentTransaction: vi.fn(),
    mockGetFeeData: vi.fn(),
    mockPrepareTransaction: vi.fn(),
    mockGetBaseFeePerGas: vi.fn(),
    mockCalculateMinFee: vi.fn(),
    mockSignTransaction: vi.fn(),
    mockBroadcastTransaction: vi.fn(),
    mockIsAddressValid: vi.fn(),
  }));
vi.mock('../../class/evm-wallet', () => {
  class EvmWallet {
    network?: string;
    createPaymentTransaction = mockCreatePaymentTransaction;
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

const FROM_ADDRESS = '0xFromAddressForMcpPocket000000000000000000';
const RECIPIENT = '0xRecipientEvmAddress00000000000000000000';

const getAddress = vi.fn(async () => FROM_ADDRESS);
const getMasterSeed = vi.fn(async () => 'test test test test test test test test test test test junk');

function makeFakeDeps(): McpCallDeps {
  return {
    storage: {} as any,
    backgroundCaller: { getAddress, getMasterSeed } as any,
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

describe('MCP transfer_native (EVM)', () => {
  let handlers: Map<string, ToolHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAddressValid.mockReturnValue(true);
    mockBalanceFetcher.mockResolvedValue('1000000000000000000'); // 1 RBTC in wei — plenty
    mockCreatePaymentTransaction.mockResolvedValue({ from: FROM_ADDRESS, to: RECIPIENT, value: 100000000000000000n });
    mockGetFeeData.mockResolvedValue({ maxFeePerGas: 2n, maxPriorityFeePerGas: 1n });
    mockPrepareTransaction.mockResolvedValue({ _prepared: true });
    mockGetBaseFeePerGas.mockResolvedValue(7n);
    mockCalculateMinFee.mockReturnValue('21000000000000'); // tiny gas fee
    mockSignTransaction.mockResolvedValue('0xsignedrawtx');
    mockBroadcastTransaction.mockResolvedValue('0xevmnativetxid');
    handlers = buildHandlers(makeFakeDeps());
  });

  it('registers the transfer_native tool', () => {
    expect(handlers.has('transfer_native')).toBe(true);
  });

  it('sends native coin in one step on rootstock: build payment → prepare → sign → broadcast', async () => {
    const result = await handlers.get('transfer_native')!({
      network: NETWORK_ROOTSTOCK,
      amount_base_units: '100000000000000000', // 0.1 RBTC
      receiver_address: `  ${RECIPIENT}  `,
    });

    expect(result.isError).toBeUndefined();
    const body = parseToolJson(result);
    expect(body.success).toBe(true);
    expect(body.network).toBe(NETWORK_ROOTSTOCK);
    expect(body.transfer_id).toBe('0xevmnativetxid');
    expect(body.amount_base_units).toBe('100000000000000000');
    expect(body.receiver_address).toBe(RECIPIENT); // trimmed
    expect(body.fee_base_units).toBe('21000000000000');
    expect(body.fee_ticker).toBe(getTickerByNetwork(NETWORK_ROOTSTOCK));
    expect(body.fee_multiplier).toBe(1);

    // Always resolved against the dedicated MCP pocket.
    expect(getAddress).toHaveBeenCalledWith(NETWORK_ROOTSTOCK, MCP_BALANCE_ACCOUNT_NUMBER);
    expect(mockCreatePaymentTransaction).toHaveBeenCalledWith(FROM_ADDRESS, RECIPIENT, '100000000000000000');
    // Default multiplier of 1.
    expect(mockPrepareTransaction).toHaveBeenCalledWith({ from: FROM_ADDRESS, to: RECIPIENT, value: 100000000000000000n }, NETWORK_ROOTSTOCK, { maxFeePerGas: 2n, maxPriorityFeePerGas: 1n }, 1n);
    expect(mockSignTransaction).toHaveBeenCalledWith({ _prepared: true }, expect.any(String), MCP_BALANCE_ACCOUNT_NUMBER);
    expect(mockBroadcastTransaction).toHaveBeenCalledWith(NETWORK_ROOTSTOCK, '0xsignedrawtx');
  });

  it('feeds the fee_multiplier into prepareTransaction (gas speed-up)', async () => {
    await handlers.get('transfer_native')!({
      network: NETWORK_BOTANIX,
      amount_base_units: '1000',
      receiver_address: RECIPIENT,
      fee_multiplier: 3,
    });

    expect(mockPrepareTransaction).toHaveBeenCalledWith(expect.anything(), NETWORK_BOTANIX, expect.anything(), 3n);
  });

  it('rejects an invalid EVM receiver address without touching the wallet', async () => {
    mockIsAddressValid.mockReturnValue(false);

    const result = await handlers.get('transfer_native')!({
      network: NETWORK_CITREA,
      amount_base_units: '1000',
      receiver_address: 'not-an-evm-address',
    });

    expect(result.isError).toBe(true);
    expect(parseToolJson(result).error).toMatch(/invalid evm receiver address/i);
    expect(mockCreatePaymentTransaction).not.toHaveBeenCalled();
    expect(mockSignTransaction).not.toHaveBeenCalled();
    expect(mockBroadcastTransaction).not.toHaveBeenCalled();
  });

  it('blocks a send when the native balance cannot cover amount + gas (no sign/broadcast)', async () => {
    mockBalanceFetcher.mockResolvedValueOnce('100'); // way less than amount + fee

    const result = await handlers.get('transfer_native')!({
      network: NETWORK_ROOTSTOCK,
      amount_base_units: '100000000000000000',
      receiver_address: RECIPIENT,
    });

    expect(result.isError).toBe(true);
    const body = parseToolJson(result);
    expect(body.error).toMatch(/insufficient/i);
    expect(body.balance_base_units).toBe('100');
    expect(mockSignTransaction).not.toHaveBeenCalled();
    expect(mockBroadcastTransaction).not.toHaveBeenCalled();
  });

  it('surfaces a broadcast failure as an MCP error, not a throw', async () => {
    mockBroadcastTransaction.mockRejectedValueOnce(new Error('eth_sendRawTransaction failed: nonce too low'));

    const result = await handlers.get('transfer_native')!({
      network: NETWORK_ROOTSTOCK,
      amount_base_units: '1000',
      receiver_address: RECIPIENT,
    });

    expect(result.isError).toBe(true);
    const body = parseToolJson(result);
    expect(body.error).toMatch(/nonce too low/i);
    expect(body.network).toBe(NETWORK_ROOTSTOCK);
  });
});
