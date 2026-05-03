import useSWR from 'swr';

import { RgbWallet, type RgbBackupPersistedState } from '../class/wallets/rgb-wallet';
import { IBackgroundCaller } from '../types/IBackgroundCaller';
import { NETWORK_RGB, NETWORK_RGB_TESTNET, Networks } from '../types/networks';

export type RgbBackupStatus = 'synced' | 'pending' | 'failed';

export interface UseRgbBackupStatusResult {
  status: RgbBackupStatus;
  pendingCount: number;
  lastBackupAt: number | null;
  lastError: RgbBackupPersistedState['lastBackupError'];
  /** Re-attempts a backup outside of any specific mutation. Returns true on
   *  success. Triggers SWR revalidation either way. */
  retry: () => Promise<boolean>;
}

interface FetcherArg {
  cacheKey: string;
  network: Networks;
  accountNumber: number;
  backgroundCaller: IBackgroundCaller;
}

const SYNCED: UseRgbBackupStatusResult = {
  status: 'synced',
  pendingCount: 0,
  lastBackupAt: null,
  lastError: null,
  retry: async () => true,
};

async function fetcher(arg: FetcherArg): Promise<RgbBackupPersistedState | null> {
  const { network, accountNumber, backgroundCaller } = arg;
  if (network !== NETWORK_RGB && network !== NETWORK_RGB_TESTNET) return null;
  const wallet = await backgroundCaller.lazyInitWallet(network, accountNumber);
  // ext popup gets a forwarding shim instead of a real RgbWallet — no banner
  // there until we wire a dedicated RPC. Mobile and ext background hit this
  // with the real instance.
  if (!(wallet instanceof RgbWallet)) return null;
  return wallet.getBackupStatus();
}

/**
 * Three-state view of the per-wallet RGB backup ledger, surfaced to the UI by
 * the warning banner on RGB home / send / receive flows.
 *
 * - `synced`: no pending mutations, no recorded error
 * - `pending`: at least one mutation hasn't been pushed to VSS yet
 *              (transient: usually clears within seconds of a transfer/issue)
 * - `failed`: the last backup attempt threw — until the user retries (or a
 *              new mutation succeeds), VSS is stale relative to local state
 *
 * See tasks/rgb-backup-failure-handling.md for why this exists.
 */
export function useRgbBackupStatus(network: Networks, accountNumber: number, backgroundCaller: IBackgroundCaller): UseRgbBackupStatusResult {
  const isRgb = network === NETWORK_RGB || network === NETWORK_RGB_TESTNET;

  const arg: FetcherArg = { cacheKey: 'rgbBackupStatus', network, accountNumber, backgroundCaller };
  const { data, mutate } = useSWR(isRgb ? arg : null, fetcher, {
    refreshInterval: 30_000,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
  });

  if (!isRgb || !data) return SYNCED;

  const pendingCount = data.pendingMutations;
  const lastError = data.lastBackupError;

  let status: RgbBackupStatus;
  if (lastError) status = 'failed';
  else if (pendingCount > 0) status = 'pending';
  else status = 'synced';

  return {
    status,
    pendingCount,
    lastBackupAt: data.lastBackupAt,
    lastError,
    retry: async () => {
      const wallet = await backgroundCaller.lazyInitWallet(network, accountNumber);
      if (!(wallet instanceof RgbWallet)) return false;
      const ok = await wallet.retryBackup();
      await mutate();
      return ok;
    },
  };
}
