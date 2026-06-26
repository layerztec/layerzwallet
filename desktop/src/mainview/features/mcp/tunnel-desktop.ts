/**
 * Single desktop entry for the MCP transport (public tunnel + local listener).
 *
 * Vite can duplicate `@shared/.../tunnel` when one caller uses `import()` and another a
 * static import — then `startTunnel` and the connection state diverge. All desktop code
 * must reach tunnel/MCP-mode APIs through this file.
 *
 * Two concepts, kept separate to avoid surprises:
 *   - PREFERENCE (`getMcpLocalMode` / `setMcpLocalMode`): which transport the user wants —
 *     local closed-circuit listener vs public tunnel. Toggling preserves the on/off state:
 *     if the agent is OFF it only records the choice (nothing starts until the user activates);
 *     if the agent is already RUNNING it switches transports live — drops the old one and
 *     starts the new one instantly. Either way the tunnel is never left running while local
 *     is selected (closed circuit).
 *   - ACTIVATION (`activateMcp` / `pauseMcp`): explicitly start/stop the preferred transport
 *     from the off state. The two transports are mutually exclusive.
 *
 * `getMcpStatus` / `getMcpPublicUrl` track the transport that is *actually live* (`activeLocal`),
 * not the preference: during a live switch they keep reporting the old transport until it is torn
 * down, so the API never claims local-only while the public tunnel is still up.
 */

import { LayerzStorage } from '../../class/layerz-storage';
import { Messenger } from '../../modules/messenger';
import { showDesktopNotification } from '../../modules/notifications';
import { DesktopMessageType } from '../../../shared/desktop-messages';

import { ensureMcpConfigured, getMcpRequestHandler, resetMcpSessions } from './mcp-desktop';
import { desktopAppLifecycle } from './modules/mcp-platform';

import {
  connectTunnel as connectTunnelShared,
  disconnectTunnel,
  getTunnelAutostartOnLaunch,
  getTunnelConnectionStatus,
  getTunnelPublicUrl,
  startTunnel,
  stopTunnel,
  subscribeTunnelConnection,
  type TunnelConnectionStatus,
} from '@shared/features/mcp/modules/tunnel';

/** `'local'` selects the closed-circuit listener; anything else (default) selects the public tunnel. */
const MODE_KEY = '@layerz/mcp-mode';
/** Whether the local listener should be running (its "autostart on launch" flag; the tunnel has its own). */
const LOCAL_ACTIVE_KEY = '@layerz/mcp-local-active';

let mcpBootstrapPromise: Promise<void> | null = null;
/** Bumped by teardown so an in-flight `ensureMcpBootstrapped` body cannot reopen transports after reset. */
let bootstrapEpoch = 0;
/** Desired transport (the checkbox): flips immediately so the UI + dedup react at once. */
let localPreference = false;
/** Transport currently authoritative for status/URL: flips only after the old one is torn down. */
let activeLocal = false;
let localUrl: string | null = null; // non-null iff the local listener is running
const localListeners = new Set<() => void>();

function notifyLocal(): void {
  localListeners.forEach((fn) => fn());
}

/**
 * Serialize transport mutations. The UI fires `activateMcp` / `pauseMcp` / `setMcpLocalMode`
 * without awaiting, so without a queue a stop could run while a start's RPC is still in flight:
 * Bun's stop would no-op (socket not bound yet) and the late start would then re-mark the listener
 * active — leaving it running after the user paused/switched off. Queuing makes the last action win
 * and keeps `localUrl` + storage consistent with the actual socket.
 */
let opChain: Promise<void> = Promise.resolve();
function enqueueTransportOp(op: () => Promise<void>): Promise<void> {
  const run = opChain.then(op, op);
  opChain = run.catch(() => {}); // keep the chain alive even if one op throws
  return run;
}

/** Start the local listener (Bun process) and record its URL. */
async function startLocalServer(): Promise<void> {
  try {
    const info = await Messenger.send(DesktopMessageType.MCP_LOCAL_SERVER_START, []);
    localUrl = info.url;
    activeLocal = true; // status/URL getters key off this, not just localPreference
    await LayerzStorage.setItem(LOCAL_ACTIVE_KEY, '1');
    notifyLocal();
  } catch (err) {
    localUrl = null;
    try {
      await LayerzStorage.setItem(LOCAL_ACTIVE_KEY, '0');
    } catch {
      // ignore — best-effort cleanup
    }
    notifyLocal();
    const message = err instanceof Error ? err.message : String(err);
    void showDesktopNotification({ title: 'Agent failed to start', body: message });
    throw err;
  }
}

/** Stop the local listener and clear its "should run" flag. No-op on the Bun side if not running. */
async function stopLocalServer(): Promise<void> {
  await Messenger.send(DesktopMessageType.MCP_LOCAL_SERVER_STOP, []);
  localUrl = null;
  await LayerzStorage.setItem(LOCAL_ACTIVE_KEY, '0');
  notifyLocal();
}

async function stopAllTransports(): Promise<void> {
  await disconnectTunnel();
  await stopLocalServer();
}

/** If teardown bumped the epoch, undo any partial bootstrap work and abandon the run. */
async function abortBootstrapIfStale(epoch: number): Promise<boolean> {
  if (epoch === bootstrapEpoch) return false;
  await stopAllTransports();
  stopTunnel();
  return true;
}

/**
 * Boot entry (called once from `<TunnelBootstrap/>` and `Home`): wire MCP deps + the tunnel
 * client, then restore whichever transport was last active. In local mode `startTunnel` is told
 * not to auto-connect (`allowAutoConnect: false`), so the public tunnel can't open at launch.
 */
export function ensureMcpBootstrapped(): Promise<void> {
  if (!mcpBootstrapPromise) {
    const epoch = bootstrapEpoch;
    mcpBootstrapPromise = (async () => {
      localPreference = (await LayerzStorage.getItem(MODE_KEY)) === 'local';
      activeLocal = localPreference;
      if (await abortBootstrapIfStale(epoch)) return;

      await ensureMcpConfigured();
      if (await abortBootstrapIfStale(epoch)) return;

      // Re-read: a toggle during ensureMcpConfigured may have persisted a new MODE_KEY.
      localPreference = (await LayerzStorage.getItem(MODE_KEY)) === 'local';
      activeLocal = localPreference;
      if (await abortBootstrapIfStale(epoch)) return;

      await startTunnel({
        handleRequest: await getMcpRequestHandler(),
        storage: LayerzStorage,
        appLifecycle: desktopAppLifecycle,
        // Closed circuit: in local mode the public tunnel must never open on launch — not even for
        // one tick — even if its autostart flag was left at '1' by a crash mid-switch.
        allowAutoConnect: !localPreference,
        onSessionChange: ({ publicUrl, idChanged }) => {
          if (__DEV__) console.log('[mcp] PUBLIC URL:', publicUrl);
          if (idChanged) void resetMcpSessions();
        },
      });
      if (await abortBootstrapIfStale(epoch)) return;

      if (localPreference) {
        await disconnectTunnel(); // keep the tunnel's autostart flag at '0' so persisted state stays consistent
        if (await abortBootstrapIfStale(epoch)) return;
        if ((await LayerzStorage.getItem(LOCAL_ACTIVE_KEY)) === '1') await startLocalServer();
      }
      if (await abortBootstrapIfStale(epoch)) return;
      notifyLocal();
    })().catch((err) => {
      if (bootstrapEpoch === epoch) mcpBootstrapPromise = null;
      throw err;
    });
  }
  return mcpBootstrapPromise;
}

/**
 * Change the transport preference (the checkbox), preserving the agent's on/off state:
 *   - OFF  → only record the choice; nothing starts (the user activates explicitly).
 *   - ON   → switch transports live: drop the old one and start the new one instantly.
 * The contradicting transport is always torn down, so "Local only" can't leave the tunnel exposed.
 */
export async function setMcpLocalMode(local: boolean): Promise<void> {
  if (local === localPreference) return;

  // Capture (sync) whether the current transport is live, then flip the *preference* immediately —
  // so the checkbox responds at once and rapid re-toggles dedupe against the guard above. Status/URL
  // stay on the old transport (via `activeLocal`) until the queued op actually tears it down.
  const wasActive = getMcpStatus() !== 'disconnected';
  localPreference = local;
  notifyLocal();

  await enqueueTransportOp(async () => {
    await LayerzStorage.setItem(MODE_KEY, local ? 'local' : 'tunnel');
    await ensureMcpBootstrapped();
    // Re-assert: a first-run bootstrap racing this toggle reads the pre-toggle MODE_KEY and would
    // clobber `localPreference` back. We persisted the new value above, so our intent is authoritative.
    localPreference = local;
    if (local) {
      await disconnectTunnel(); // closed circuit: tear the tunnel down BEFORE reporting local
      activeLocal = true;
      notifyLocal();
      if (wasActive) {
        await startLocalServer();
      } else {
        // Preference-only switch: clear a stale autostart flag so isMcpActivated stays honest.
        await LayerzStorage.setItem(LOCAL_ACTIVE_KEY, '0');
      }
    } else {
      await stopLocalServer(); // stop the local listener BEFORE reporting tunnel
      activeLocal = false;
      notifyLocal();
      if (wasActive) await connectTunnelShared();
    }
  });
}

/** Explicitly start the preferred transport (Activate button / play), stopping the other. */
export async function activateMcp(): Promise<void> {
  await enqueueTransportOp(async () => {
    await ensureMcpBootstrapped();
    // Re-read MODE_KEY: bootstrap's first run can clobber in-memory preference from storage.
    localPreference = (await LayerzStorage.getItem(MODE_KEY)) === 'local';
    if (localPreference) {
      await disconnectTunnel(); // closed circuit: no public tunnel at all
      await startLocalServer();
    } else {
      await stopLocalServer();
      activeLocal = false;
      notifyLocal();
      await connectTunnelShared();
    }
  });
}

/** Explicitly stop the agent (pause). Tears down both transports so a pause can never leave one up. */
export async function pauseMcp(): Promise<void> {
  await enqueueTransportOp(stopAllTransports);
}

/**
 * Full transport teardown — stops listeners/tunnel, clears in-memory state, and drops the
 * bootstrap latch so a future READY session can re-initialize. Used on wallet reset and when
 * leaving the unlocked shell.
 */
export function teardownMcpTransport(): Promise<void> {
  return enqueueTransportOp(async () => {
    bootstrapEpoch++; // invalidate any in-flight bootstrap before stopping sockets
    await stopAllTransports();
    stopTunnel();
    mcpBootstrapPromise = null;
    localPreference = false;
    activeLocal = false;
    localUrl = null;
    notifyLocal();
  });
}

/** True if the preferred transport is actually running (used to skip the activate prompt). */
export async function isMcpActivated(): Promise<boolean> {
  return localPreference ? localUrl !== null : getTunnelAutostartOnLaunch();
}

export function getMcpLocalMode(): boolean {
  return localPreference;
}

/** Active public URL for the transport that is *actually live* (null until it's been activated). */
export function getMcpPublicUrl(): string | null {
  return activeLocal ? localUrl : getTunnelPublicUrl();
}

export function getMcpStatus(): TunnelConnectionStatus {
  if (activeLocal) return localUrl ? 'connected' : 'disconnected';
  return getTunnelConnectionStatus();
}

/** Subscribe to either transport's changes (status / URL / preference). */
export function subscribeMcp(onChange: () => void): () => void {
  const unsubscribeTunnel = subscribeTunnelConnection(onChange);
  localListeners.add(onChange);
  return () => {
    unsubscribeTunnel();
    localListeners.delete(onChange);
  };
}
