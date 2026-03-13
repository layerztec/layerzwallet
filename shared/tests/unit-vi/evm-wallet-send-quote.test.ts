import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvmWallet } from '../../class/evm-wallet';
import { NETWORK_ROOTSTOCK } from '../../types/networks';

// @ts-ignore - injected by vi.mock above
import { __setMockProvider } from '../../models/network-getters';

const FROM = '0x0000000000000000000000000000000000000001';
const TO = '0x0000000000000000000000000000000000000002';
const TOKEN_ID = '0x542fDA317318eBF1d3DEAf76E0b632741A7e677d'; // checksum-valid address
const GAS_FEE = '1260000000'; // example fee in wei

// Mock getRpcProvider to return a fake provider
vi.mock('../../models/network-getters', () => {
  let mockProvider: any;
  return {
    getRpcProvider: () => mockProvider,
    getChainIdByNetwork: () => 30,
    __setMockProvider: (p: any) => {
      mockProvider = p;
    },
  };
});

function createWallet(): EvmWallet {
  const w = new EvmWallet();
  w.network = NETWORK_ROOTSTOCK;

  // Stub internal methods that hit the network
  vi.spyOn(w, 'getFeeData' as any).mockResolvedValue({
    gasPrice: 60000000n,
    maxFeePerGas: null,
    maxPriorityFeePerGas: null,
  });
  vi.spyOn(w, 'getBaseFeePerGas' as any).mockRejectedValue(new Error('no EIP-1559'));
  vi.spyOn(w, 'prepareTransaction' as any).mockResolvedValue({ gasLimit: 21000n, gasPrice: 60000000n, type: 0 });
  vi.spyOn(w, 'calculateMinFee' as any).mockReturnValue(GAS_FEE);
  vi.spyOn(w, 'createPaymentTransaction' as any).mockResolvedValue({});
  vi.spyOn(w, 'createTokenTransferTransaction' as any).mockResolvedValue({});

  return w;
}

function setupProvider({ nativeBalance, tokenBalance }: { nativeBalance: bigint; tokenBalance?: bigint }) {
  // ethers.Contract uses provider.call() for view functions — return ABI-encoded uint256
  const encodedBalance = '0x' + (tokenBalance ?? 0n).toString(16).padStart(64, '0');

  const provider = {
    getBalance: vi.fn().mockResolvedValue(nativeBalance),
    call: vi.fn().mockResolvedValue(encodedBalance),
  };

  // @ts-ignore - test helper
  __setMockProvider(provider);
}

describe('EvmWallet getSendQuote balance checks', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('native send: passes when balance covers amount + fee', async () => {
    const w = createWallet();
    setupProvider({ nativeBalance: 10000000000000n });

    const quote = await w.getSendQuote({
      fromAddress: FROM,
      toAddress: TO,
      amount: '1000000000000',
    });

    expect(quote.fee).toBe(GAS_FEE);
    expect(quote.request.amount).toBe('1000000000000');
  });

  it('native send: throws when balance < amount + fee', async () => {
    const w = createWallet();
    setupProvider({ nativeBalance: 100n });

    await expect(
      w.getSendQuote({
        fromAddress: FROM,
        toAddress: TO,
        amount: '1000000000000000000',
      })
    ).rejects.toThrow('Insufficient RBTC balance');
  });

  it('token send: throws gas error when native balance too low for gas', async () => {
    const w = createWallet();
    setupProvider({ nativeBalance: 0n, tokenBalance: 5000000000000000000n });

    await expect(
      w.getSendQuote({
        fromAddress: FROM,
        toAddress: TO,
        amount: '1000000000000000000',
        tokenId: TOKEN_ID,
      })
    ).rejects.toThrow('Insufficient RBTC for gas');
  });

  it('token send: throws token error when token balance too low', async () => {
    const w = createWallet();
    setupProvider({ nativeBalance: 10000000000000n, tokenBalance: 100n });

    await expect(
      w.getSendQuote({
        fromAddress: FROM,
        toAddress: TO,
        amount: '1000000000000000000', // 1 token, but only 100 wei of token
        tokenId: TOKEN_ID,
      })
    ).rejects.toThrow(/Insufficient .* balance/);
  });

  it('token send: does NOT add token amount to native balance check (regression)', async () => {
    const w = createWallet();
    // Native balance covers gas but NOT gas + token amount
    // Old buggy code would reject this; fixed code should pass
    setupProvider({ nativeBalance: 5000000000000n, tokenBalance: 5000000000000000000n });

    // This should NOT throw — native balance covers gas, token balance covers amount
    const quote = await w.getSendQuote({
      fromAddress: FROM,
      toAddress: TO,
      amount: '1000000000000000000', // 1 token — way more than native balance, but that's fine
      tokenId: TOKEN_ID,
    });

    expect(quote.fee).toBe(GAS_FEE);
  });
});
