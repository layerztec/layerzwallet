/**
 * Single desktop entry for `@shared/features/mcp/modules/tunnel`.
 *
 * Vite can duplicate that module when one caller uses `import()` and another
 * uses a static import — then `startTunnel` and `connectTunnel` see different
 * singleton state. All desktop code must import tunnel APIs from this file.
 */

import { LayerzStorage } from '../../class/layerz-storage';

import { desktopAppLifecycle, desktopMcpDeps } from './modules/mcp-platform';

import {
  connectTunnel as connectTunnelShared,
  disconnectTunnel,
  getTunnelAutostartOnLaunch,
  getTunnelConnectionStatus,
  getTunnelPublicUrl,
  startTunnel,
  subscribeTunnelConnection,
} from '@shared/features/mcp/modules/tunnel';

export { disconnectTunnel, getTunnelAutostartOnLaunch, getTunnelConnectionStatus, getTunnelPublicUrl, subscribeTunnelConnection };

let bootstrapPromise: Promise<void> | null = null;

/** Idempotent: wires MCP + calls `startTunnel` once per app session. */
export function ensureTunnelBootstrapped(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const adapters = await import('../../modules/load-adapters');
      await adapters.ensureWalletAdapters();

      const { configureMcp, handleMcpRequest, resetMcpSessions } = await import('@shared/features/mcp/modules/mcp');
      configureMcp(desktopMcpDeps, { name: 'layerz-wallet-desktop' });

      await startTunnel({
        handleRequest: handleMcpRequest,
        storage: LayerzStorage,
        appLifecycle: desktopAppLifecycle,
        onSessionChange: ({ publicUrl, idChanged }) => {
          if (__DEV__) console.log('[mcp] PUBLIC URL:', publicUrl);
          if (idChanged) resetMcpSessions();
        },
      });
    })().catch((err) => {
      bootstrapPromise = null;
      throw err;
    });
  }
  return bootstrapPromise;
}

/** Waits for bootstrap, then connects (play / Activate). */
export async function connectTunnel(): Promise<void> {
  await ensureTunnelBootstrapped();
  return connectTunnelShared();
}
