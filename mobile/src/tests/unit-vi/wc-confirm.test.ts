import { beforeEach, describe, expect, it, vi } from 'vitest';

// The service module pulls in WalletKit/Core and the provider bridge —
// irrelevant (and heavy) for testing the confirm primitive; stub them.
vi.mock('@walletconnect/core', () => ({ Core: class {} }));
vi.mock('@reown/walletkit', () => ({ WalletKit: { init: vi.fn() } }));
vi.mock('@utexo/webrgb-walletconnect', () => ({ createWalletConnectWallet: vi.fn() }));
vi.mock('@/src/class/layerz-storage', () => ({ LayerzStorage: { getItem: vi.fn(async () => ''), setItem: vi.fn(async () => {}) } }));
vi.mock('../../features/walletconnect/modules/wc-provider', () => ({
  buildBackend: vi.fn(),
  resolveAccount: vi.fn(),
  WC_NETWORK: 'utexo',
  WC_METHODS: ['enable', 'getInfo'],
  WC_RPC_METHODS: ['rgb_enable', 'rgb_getInfo'],
}));

import { wcService } from '../../features/walletconnect/modules/wc-service';

describe('wcService.confirm', () => {
  beforeEach(() => {
    // Resolve any prompt left over from a previous test.
    wcService.snapshot().prompt?.resolve(false);
  });

  it('approve resolves true before expiry', async () => {
    const p = wcService.confirm('t', 'https://d.app', 'details', Date.now() + 60_000);
    wcService.snapshot().prompt!.resolve(true);
    await expect(p).resolves.toBe(true);
    expect(wcService.snapshot().prompt).toBeNull();
  });

  it('reject resolves false', async () => {
    const p = wcService.confirm('t', 'o', 'd', Date.now() + 60_000);
    wcService.snapshot().prompt!.resolve(false);
    await expect(p).resolves.toBe(false);
  });

  it('a stale approve after expiry does not grant', async () => {
    vi.useFakeTimers();
    try {
      const p = wcService.confirm('t', 'o', 'd', Date.now() + 1_000);
      const prompt = wcService.snapshot().prompt!;
      vi.advanceTimersByTime(2_000); // expiry timer fires -> finish(false)
      prompt.resolve(true); // stale tap
      await expect(p).resolves.toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects immediately when the request is already expired', async () => {
    await expect(wcService.confirm('t', 'o', 'd', Date.now() - 1)).resolves.toBe(false);
    expect(wcService.snapshot().prompt).toBeNull();
  });

  it('rejects immediately on an already-aborted signal (no ghost prompt)', async () => {
    const ctl = new AbortController();
    ctl.abort();
    await expect(wcService.confirm('t', 'o', 'd', Date.now() + 60_000, ctl.signal)).resolves.toBe(false);
    expect(wcService.snapshot().prompt).toBeNull();
  });

  it('abort mid-prompt auto-rejects and clears the prompt', async () => {
    const ctl = new AbortController();
    const p = wcService.confirm('t', 'o', 'd', Date.now() + 60_000, ctl.signal);
    expect(wcService.snapshot().prompt).not.toBeNull();
    ctl.abort();
    await expect(p).resolves.toBe(false);
    expect(wcService.snapshot().prompt).toBeNull();
  });

  it('double resolve is idempotent', async () => {
    const p = wcService.confirm('t', 'o', 'd', Date.now() + 60_000);
    const prompt = wcService.snapshot().prompt!;
    prompt.resolve(true);
    prompt.resolve(false);
    await expect(p).resolves.toBe(true);
  });

  it('carries the verification verdict into the prompt', () => {
    void wcService.confirm('t', 'o', 'd', Date.now() + 60_000, undefined, 'UNKNOWN');
    expect(wcService.snapshot().prompt?.verification).toBe('UNKNOWN');
    wcService.snapshot().prompt!.resolve(false);
  });
});
