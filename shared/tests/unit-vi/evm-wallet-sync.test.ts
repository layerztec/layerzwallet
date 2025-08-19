import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvmWallet } from '../../class/evm-wallet';

describe('EvmWallet.syncAccountHistorySegment', () => {
  const baseUrl = 'https://explorer.example/api';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('paginates when results length = 10000 and advances block range; resumes next run', async () => {
    const e = new EvmWallet();
    e.address = '0xabc';

    const firstPage = Array.from({ length: 10000 }).map((_, i) => ({ hash: `0xhash${i}`, transactionIndex: i }));
    const secondPage = Array.from({ length: 123 }).map((_, i) => ({ hash: `0xhashB${i}`, transactionIndex: i }));

    const fetchMock = vi.spyOn(global, 'fetch' as any).mockImplementation((url: any) => {
      const u = new URL(url);
      const page = u.searchParams.get('page');
      const startblock = u.searchParams.get('startblock');
      const endblock = u.searchParams.get('endblock');
      expect(startblock).toBe('0');
      expect(endblock).toBe('1000');
      if (!page) {
        return Promise.resolve({ json: () => Promise.resolve({ message: 'OK', result: firstPage }) } as any);
      }
      expect(page).toBe('2');
      return Promise.resolve({ json: () => Promise.resolve({ message: 'OK', result: secondPage }) } as any);
    });

    await e.syncAccountHistorySegment(baseUrl, 'txlist', 1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockClear();
    // second run continues from 1000..1999
    const finalPage = Array.from({ length: 10 }).map((_, i) => ({ hash: `0xC${i}`, transactionIndex: i }));
    fetchMock.mockImplementation((url: any) => {
      const u = new URL(url);
      const page = u.searchParams.get('page');
      const startblock = u.searchParams.get('startblock');
      const endblock = u.searchParams.get('endblock');
      expect(startblock).toBe('1001');
      expect(endblock).toBe('2000');
      expect(page).toBeNull();
      return Promise.resolve({ json: () => Promise.resolve({ message: 'OK', result: finalPage }) } as any);
    });

    await e.syncAccountHistorySegment(baseUrl, 'txlist', 2000);
  });
});
