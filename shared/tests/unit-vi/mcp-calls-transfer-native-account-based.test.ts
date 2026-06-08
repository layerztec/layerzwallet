/**
 * Tests the account-based branch of the MCP `transfer_native` tool (Spark BTC, Stacks sBTC).
 *
 * Spark and Stacks are single-address wallets implementing `InterfaceAccountBasedWallet.pay(addr,
 * amountSats)` — the same call the UI's single SendAccountBased screen uses. The handler keeps ONE
 * shared codepath for every such network: validate the address (`validateAddress`), instantiate the
 * wallet, narrow via the `walletIsAccountBased` trait, then `pay(addr, Number(amount))`.
 * Balance/preconditions are enforced by the wallet itself (Spark SDK; Stacks `pay()` loads its sBTC
 * balance on demand), so the Spark and Stacks codepaths do NOT diverge.
 *
 * These tests pin: the unified one-step send (incl. amount->number coercion, address trim, success
 * toast/tracking), address validation, the account-based trait guard, a missing/invalid txid from
 * pay() reported as an error, and that wallet/SDK errors (incl. insufficient funds) surface as MCP
 * errors (not throws).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MCP_BALANCE_ACCOUNT_NUMBER } from '../../hooks/AccountNumberContext';
import { registerWalletMcpCalls } from '../../features/mcp/modules/mcp-calls';
import type { McpCallDeps } from '../../features/mcp/modules/mcp-deps';
import { NETWORK_SPARK, NETWORK_STACKS } from '../../types/networks';

// Heavy module graph pulled in at import time by mcp-calls.ts — stub it so the surface stays
// cheap and deterministic (mirrors mcp-calls-transfer-token-liquid.test.ts).
vi.mock('@flashnet/sdk', () => ({ FlashnetClient: vi.fn(), isFlashnetError: vi.fn().mockReturnValue(false) }));
vi.mock('@buildonspark/spark-sdk', () => ({ isValidSparkAddress: vi.fn().mockReturnValue(true) }));
vi.mock('../../hooks/useTransferService', () => ({ useTransferService: vi.fn(), getTransferServiceManager: vi.fn(), setFlashnetAccountNumber: vi.fn() }));
vi.mock('../../hooks/useExchangeRate', () => ({ exchangeRateFetcher: vi.fn() }));
vi.mock('../../hooks/useBalance', () => ({ balanceFetcher: vi.fn() }));
vi.mock('../../hooks/useTokenBalance', () => ({ tokenBalanceFetcher: vi.fn() }));
vi.mock('../../features/mcp/modules/mcp-activity-log', () => ({ pushMcpActivityLog: vi.fn() }));

// Address validation is unified through `validateAddress(network, address)` for every account-based
// network — hoisted spy so we can toggle validity per test.
const { mockValidateAddress } = vi.hoisted(() => ({ mockValidateAddress: vi.fn() }));
vi.mock('../../modules/wallet-utils', () => ({ validateAddress: mockValidateAddress }));

type ToolHandler = (input: any) => Promise<{ content: { text: string }[]; isError?: boolean }>;

function parseToolJson(result: { content: { text: string }[] }): any {
  return JSON.parse(result.content[0].text);
}

const SPARK_RECIPIENT = 'spark1recipientexampleaddress00000000000';
const STACKS_RECIPIENT = 'SP2RECIPIENTEXAMPLEPRINCIPAL0000000000000';

const mockSparkPay = vi.fn();
const mockStacksPay = vi.fn();

// Fake account-based wallets. The handler narrows via the structural `walletIsAccountBased` guard,
// which only needs getOffchainReceiveAddress/pay/getOffchainBalance — same shape for both networks,
// underscoring that their codepaths are identical.
const sparkWallet = { getOffchainReceiveAddress: vi.fn(), getOffchainBalance: vi.fn(), pay: mockSparkPay };
const stacksWallet = { getOffchainReceiveAddress: vi.fn(), getOffchainBalance: vi.fn(), pay: mockStacksPay };

let walletToReturn: unknown;
const lazyInitWallet = vi.fn(async (network: string) => (walletToReturn !== undefined ? walletToReturn : network === NETWORK_STACKS ? stacksWallet : sparkWallet));

function makeFakeDeps(): McpCallDeps {
  return {
    storage: {} as any,
    backgroundCaller: { lazyInitWallet } as any,
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

describe('MCP transfer_native (account-based: Spark & Stacks share one codepath)', () => {
  let handlers: Map<string, ToolHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    walletToReturn = undefined;
    mockValidateAddress.mockReturnValue(true);
    mockSparkPay.mockResolvedValue('spark-transfer-id-123');
    mockStacksPay.mockResolvedValue('0xstackstxid');
    handlers = buildHandlers(makeFakeDeps());
  });

  it('sends native Spark (BTC) via pay(addr, Number(amount)) and fires the success toast', async () => {
    const deps = makeFakeDeps();
    handlers = buildHandlers(deps);

    const result = await handlers.get('transfer_native')!({
      network: NETWORK_SPARK,
      amount_base_units: '50000',
      receiver_address: `  ${SPARK_RECIPIENT}  `,
    });

    expect(result.isError).toBeUndefined();
    const body = parseToolJson(result);
    expect(body.success).toBe(true);
    expect(body.network).toBe(NETWORK_SPARK);
    expect(body.transfer_id).toBe('spark-transfer-id-123');
    expect(body.amount_base_units).toBe('50000');
    expect(body.receiver_address).toBe(SPARK_RECIPIENT); // trimmed

    expect(lazyInitWallet).toHaveBeenCalledWith(NETWORK_SPARK, MCP_BALANCE_ACCOUNT_NUMBER);
    expect(mockValidateAddress).toHaveBeenCalledWith(NETWORK_SPARK, SPARK_RECIPIENT);
    expect(mockSparkPay).toHaveBeenCalledWith(SPARK_RECIPIENT, 50000); // JS number

    // success side-effects fire on the happy path
    expect(deps.trackToolCall).toHaveBeenCalledWith('transfer_native');
    expect(deps.showSuccessToast).toHaveBeenCalledTimes(1);
  });

  it('sends native Stacks (sBTC) via the identical path — pay(addr, Number(amount))', async () => {
    const result = await handlers.get('transfer_native')!({
      network: NETWORK_STACKS,
      amount_base_units: '25000',
      receiver_address: `  ${STACKS_RECIPIENT}  `,
    });

    expect(result.isError).toBeUndefined();
    const body = parseToolJson(result);
    expect(body.success).toBe(true);
    expect(body.network).toBe(NETWORK_STACKS);
    expect(body.transfer_id).toBe('0xstackstxid');
    expect(body.receiver_address).toBe(STACKS_RECIPIENT); // trimmed

    expect(lazyInitWallet).toHaveBeenCalledWith(NETWORK_STACKS, MCP_BALANCE_ACCOUNT_NUMBER);
    expect(mockValidateAddress).toHaveBeenCalledWith(NETWORK_STACKS, STACKS_RECIPIENT);
    expect(mockStacksPay).toHaveBeenCalledWith(STACKS_RECIPIENT, 25000);
  });

  it.each([
    [NETWORK_SPARK, 'not-a-spark-address'],
    [NETWORK_STACKS, 'not-a-stacks-principal'],
  ])('rejects an invalid %s receiver address without paying', async (network, badAddr) => {
    mockValidateAddress.mockReturnValue(false);

    const result = await handlers.get('transfer_native')!({ network, amount_base_units: '1000', receiver_address: badAddr });

    expect(result.isError).toBe(true);
    expect(parseToolJson(result).error).toMatch(/invalid receiver address/i);
    expect(mockSparkPay).not.toHaveBeenCalled();
    expect(mockStacksPay).not.toHaveBeenCalled();
  });

  it('rejects a wallet that is not account-based (trait guard)', async () => {
    walletToReturn = { foo: 'not a wallet' };

    const result = await handlers.get('transfer_native')!({
      network: NETWORK_SPARK,
      amount_base_units: '1000',
      receiver_address: SPARK_RECIPIENT,
    });

    expect(result.isError).toBe(true);
    expect(parseToolJson(result).error).toMatch(/does not support native transfers/i);
    expect(mockSparkPay).not.toHaveBeenCalled();
  });

  it.each([
    ['', 'empty string'],
    [null, 'null'],
    [undefined, 'undefined'],
  ])('treats a pay() result of %s (%s) — no valid txid — as an error, without a success toast', async (badTxid) => {
    const deps = makeFakeDeps();
    handlers = buildHandlers(deps);
    mockSparkPay.mockResolvedValueOnce(badTxid as any);

    const result = await handlers.get('transfer_native')!({
      network: NETWORK_SPARK,
      amount_base_units: '1000',
      receiver_address: SPARK_RECIPIENT,
    });

    expect(mockSparkPay).toHaveBeenCalledWith(SPARK_RECIPIENT, 1000);
    expect(result.isError).toBe(true);
    expect(parseToolJson(result).error).toMatch(/did not return an id/i);
    expect(deps.showSuccessToast).not.toHaveBeenCalled();
  });

  it.each([
    [NETWORK_SPARK, mockSparkPay, 'Spark transfer failed: insufficient funds'],
    [NETWORK_STACKS, mockStacksPay, 'Insufficient sBTC balance. Have 5, need 25000'],
  ])('surfaces a %s pay() failure (incl. insufficient funds) as an MCP error, not a throw', async (network, payMock, message) => {
    payMock.mockRejectedValueOnce(new Error(message));

    const result = await handlers.get('transfer_native')!({ network, amount_base_units: '25000', receiver_address: network === NETWORK_SPARK ? SPARK_RECIPIENT : STACKS_RECIPIENT });

    expect(result.isError).toBe(true);
    const body = parseToolJson(result);
    expect(body.error).toBe(message);
    expect(body.network).toBe(network);
  });
});
