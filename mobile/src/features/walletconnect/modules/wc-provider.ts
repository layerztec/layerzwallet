/**
 * Bridges a WalletConnect session context to a WebRGB backend built on our
 * RGB wallet. v1 surface: the read set + blindReceive — nothing else is
 * exposed, so the adapter advertises exactly these in getInfo().methods.
 *
 * The SDK's WebRgbProvider wraps the RAW SDK wallet (our IRgbWallet proxy —
 * a UTEXOWallet with VSS methods overridden; everything else passes
 * through). Mutations through that handle bypass RgbWallet's backup ledger,
 * so the run wrapper fires a backup after blindReceive (lesson X4/X10 in
 * tasks/rgb-test-plan.md: a receive that exists only locally is lost on the
 * next restore).
 */
import type { UTEXOWallet } from '@utexo/rgb-sdk-rn';
import { WebRgbProvider, type WebRgbApproval } from '@utexo/rgb-sdk-rn/webrgb';
import type { WalletConnectBackend, WalletConnectWalletContext } from '@utexo/webrgb-walletconnect';

import { BackgroundExecutor } from '@/src/modules/background-executor';
import { RgbWallet } from '@shared/class/wallets/rgb-wallet';
import { NETWORK_RGB_TESTNET } from '@shared/types/networks';

/** The SDK chain name for our RGB testnet (mobile maps testnet → 'utexo'). */
export const WC_NETWORK = 'utexo';

/** dApp accounts are pinned to account 0 — same policy as the rest of RGB. */
const WC_ACCOUNT_NUMBER = 0;

/** v1 method surface (WebRGB names). Order matters only for display. */
export const WC_METHODS = ['enable', 'getInfo', 'getAddress', 'blindReceive', 'listAssets', 'getAssetBalance', 'listTransfers', 'getTransferStatus', 'decodeRgbInvoice'] as const;

/** Same set as wire RPC names, for session validation. */
export const WC_RPC_METHODS = WC_METHODS.map((m) => `rgb_${m}`);

async function getRgbWallet(): Promise<RgbWallet> {
  const wallet = await BackgroundExecutor.lazyInitWallet(NETWORK_RGB_TESTNET, WC_ACCOUNT_NUMBER);
  if (!(wallet instanceof RgbWallet)) throw new Error('RGB wallet is unavailable');
  return wallet;
}

/** `rgb:utexo:<pubkey>` — the account identity the transport binds sessions to. */
export async function resolveAccount(): Promise<string> {
  const wallet = await getRgbWallet();
  // getNodeInfo lives on the raw UTEXOWallet surface (the IRgbWallet proxy
  // forwards it at runtime; the shared type doesn't declare it).
  const sdk = wallet.getSdk() as unknown as UTEXOWallet;
  if (typeof sdk.getNodeInfo !== 'function') throw new Error('RGB node does not expose node info');
  const info = await sdk.getNodeInfo();
  return `rgb:${WC_NETWORK}:${info.pubkey}`;
}

type Host = {
  enqueue<T>(action: () => Promise<T>): Promise<T>;
  confirm(title: string, origin: string, details: string, expiresAt: number, signal?: AbortSignal): Promise<boolean>;
};

export async function buildBackend(context: WalletConnectWalletContext, host: Host): Promise<WalletConnectBackend> {
  const rgbWallet = await getRgbWallet();
  const provider = new WebRgbProvider(rgbWallet.getSdk() as unknown as UTEXOWallet, {
    origin: context.origin,
    // The transport session was already approved (or restored) before
    // getProvider is called, so enable() must not prompt a second time.
    sessionApproved: true,
    assertAuthorized: () => context.assertAuthorized(),
    confirm: (request: WebRgbApproval) => {
      // v1 only ever prompts for receive invoices; anything else that
      // somehow reaches here is rejected by not being in the backend map.
      const details = [
        `Asset: ${request.params.assetId ?? 'Any asset (including a new one)'}`,
        `Amount: ${request.params.amount ?? 'Any amount'} base units`,
        `Network: ${WC_NETWORK}`,
        `Confirmations: ${request.params.minConfirmations}`,
        `Expires in: ${request.params.durationSeconds} seconds`,
      ].join('\n');
      return host.confirm('Create RGB receive invoice?', request.origin, details, Date.now() + 240_000, context.requestSignal);
    },
  });
  context.signal.addEventListener('abort', () => provider.revoke(), { once: true });

  const run = <A extends unknown[], R>(method: string, action: (...args: A) => Promise<R>) =>
    (...args: A): Promise<R> =>
      host.enqueue(async () => {
        context.assertAuthorized();
        const result = await action(...args);
        if (method === 'blindReceive') {
          // The invoice's blinding data lives only in the local stash until
          // a backup lands — push one now, best-effort (the ledger banner
          // keeps nagging if it fails).
          await rgbWallet.retryBackup().catch(() => {});
        }
        return result;
      });

  return {
    enable: run('enable', () => provider.enable()),
    getInfo: run('getInfo', () => provider.getInfo()),
    getAddress: run('getAddress', () => provider.getAddress()),
    blindReceive: run('blindReceive', provider.blindReceive.bind(provider)),
    listAssets: run('listAssets', () => provider.listAssets()),
    getAssetBalance: run('getAssetBalance', provider.getAssetBalance.bind(provider)),
    listTransfers: run('listTransfers', provider.listTransfers.bind(provider)),
    getTransferStatus: run('getTransferStatus', provider.getTransferStatus.bind(provider)),
    decodeRgbInvoice: run('decodeRgbInvoice', provider.decodeRgbInvoice.bind(provider)),
  };
}
