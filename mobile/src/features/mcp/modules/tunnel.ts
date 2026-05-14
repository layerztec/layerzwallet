/**
 * Public-tunnel WebSocket client.
 *
 * Concerns:
 *   - Maintain a single WebSocket to the tunnel server.
 *   - Persist the assigned `sessionId` to AsyncStorage so the public URL
 *     stays the same across app relaunches and server restarts.
 *   - Reconnect with `?sessionId=<id>` so the server can resume the same
 *     session (queue-replay any in-flight HTTP requests).
 *   - On `AppState` → active, reconnect immediately if the socket is not open
 *     (e.g. after backgrounding / OS closing the connection).
 *   - Autostart on cold launch is off by default; the user opts in via play, which
 *     persists `@layerz/mcp-tunnel-autostart-on-launch`. Pause clears that flag.
 *   - Forward each tunneled `http_request` envelope to a caller-supplied
 *     handler and ship its response back.
 *
 * This module knows nothing about MCP. The handler is plain-old request/reply.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';

const STORAGE_KEY = '@layerz/mcp-tunnel-session-id';
/** When `'1'`, cold start calls `connect()` after `startTunnel`. Default / missing = do not connect until the user taps play. */
const AUTOSTART_STORAGE_KEY = '@layerz/mcp-tunnel-autostart-on-launch';
const DEFAULT_TUNNEL_URL = process.env.EXPO_PUBLIC_MCP_TUNNEL_URL ?? 'wss://layerz.me:4433/connect';
const PING_INTERVAL_MS = 30_000;
const RECONNECT_INITIAL_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

// NOTE: TunnelHttpRequest / TunnelHttpResponse are duplicated on the server
// side in mcp-websocket-tunnel/server.ts. Keep both definitions in sync.
export type TunnelHttpRequest = {
  type: 'http_request';
  requestId: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  bodyBase64: string;
};

export type TunnelHttpResponse = {
  type: 'http_response';
  requestId: string;
  status: number;
  headers: Record<string, string>;
  bodyBase64: string;
};

export type RequestHandler = (req: TunnelHttpRequest) => Promise<TunnelHttpResponse>;

export type StartTunnelOptions = {
  /** Caller-supplied handler invoked for every incoming `http_request`. */
  handleRequest: RequestHandler;
  /** Override the default tunnel URL (e.g. for tests). */
  url?: string;
  /**
   * Called whenever the tunnel session id changes. The first time it fires
   * delivers the initial public URL; on resume the same URL is returned so
   * external agents don't need to reconfigure.
   */
  onSessionChange?: (info: {
    sessionId: string;
    publicUrl: string;
    resumed: boolean;
    /**
     * True if the server gave us a different sessionId than we asked for —
     * means our resume failed (e.g. server wiped its DB) and any consumer
     * state keyed off the old id should be reset.
     */
    idChanged: boolean;
  }) => void;
};

export type TunnelConnectionStatus = 'connected' | 'connecting' | 'disconnected';

let started = false;
let socket: WebSocket | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelayMs = RECONNECT_INITIAL_MS;

let tunnelSessionId: string | null = null;
let lastTunnelPublicUrl: string | null = null;
let manualDisconnect = false;
let cachedBaseUrl: string | null = null;
let cachedOpts: StartTunnelOptions | null = null;
let appStateSub: ReturnType<typeof AppState.addEventListener> | null = null;

/** One in-flight handler per tunnel `requestId` (server may replay while the first is still running). */
const inflightTunnelByRequestId = new Map<string, Promise<TunnelHttpResponse>>();

const statusListeners = new Set<() => void>();

/** After reconnect, `socket` is the live WebSocket; slow handlers must not reply on a stale `ws`. */
function wsForTunnelReply(fallback: WebSocket): WebSocket {
  return socket?.readyState === WebSocket.OPEN ? socket : fallback;
}

function notifyStatus(): void {
  statusListeners.forEach((fn) => fn());
}

export function getTunnelPublicUrl(): string | null {
  return lastTunnelPublicUrl;
}

export function subscribeTunnelConnection(onStoreChange: () => void): () => void {
  statusListeners.add(onStoreChange);
  return () => {
    statusListeners.delete(onStoreChange);
  };
}

export function getTunnelConnectionStatus(): TunnelConnectionStatus {
  if (!started || manualDisconnect) return 'disconnected';
  if (socket?.readyState === WebSocket.OPEN) return 'connected';
  return 'connecting';
}

/**
 * Read the persisted "user wants tunnel on" flag — written by
 * `connectTunnel` / `disconnectTunnel`.
 *
 * Returns `false` when the key has never been written (never started yet).
 */
export async function getTunnelAutostartOnLaunch(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(AUTOSTART_STORAGE_KEY)) === '1';
  } catch (err) {
    console.warn('[tunnel] failed to read autostart preference:', err);
    return false;
  }
}

async function persistAutostartOnLaunch(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTOSTART_STORAGE_KEY, enabled ? '1' : '0');
  } catch (err) {
    console.warn('[tunnel] failed to persist autostart preference:', err);
  }
}

/** User pause: close socket, no auto-reconnect until `connectTunnel()`. Clears autostart-on-launch. */
export async function disconnectTunnel(): Promise<void> {
  console.log('[tunnel] user pause (disconnectTunnel)');
  manualDisconnect = true;
  await persistAutostartOnLaunch(false);
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
  if (socket) {
    try {
      socket.close();
    } catch {}
    socket = null;
  }
  inflightTunnelByRequestId.clear();
  notifyStatus();
}

/** User resume: opt in to starting the tunnel on future app launches, then connect. */
export async function connectTunnel(): Promise<void> {
  if (!cachedBaseUrl || !cachedOpts) {
    console.warn('[tunnel] connectTunnel: startTunnel has not run yet');
    return;
  }
  await persistAutostartOnLaunch(true);
  manualDisconnect = false;
  started = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  const w = socket;
  if (w && (w.readyState === WebSocket.OPEN || w.readyState === WebSocket.CONNECTING)) {
    notifyStatus();
    return;
  }
  console.log('[tunnel] user resume → connect()');
  connect(cachedBaseUrl, cachedOpts);
}

export async function startTunnel(opts: StartTunnelOptions): Promise<void> {
  cachedOpts = opts;
  cachedBaseUrl = opts.url ?? DEFAULT_TUNNEL_URL;
  if (started) {
    notifyStatus();
    return;
  }
  console.log('[tunnel] startTunnel');

  if (!appStateSub) {
    appStateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next !== 'active' || !started || manualDisconnect) return;
      const w = socket;
      if (w && (w.readyState === WebSocket.OPEN || w.readyState === WebSocket.CONNECTING)) return;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      reconnectDelayMs = RECONNECT_INITIAL_MS;
      console.log('[tunnel] app foreground — reconnecting immediately');
      connect(cachedBaseUrl!, cachedOpts!);
    });
  }

  const autostart = await getTunnelAutostartOnLaunch();

  try {
    tunnelSessionId = await AsyncStorage.getItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[tunnel] failed to read stored sessionId:', err);
  }

  if (started) {
    notifyStatus();
    return;
  }

  started = true;
  manualDisconnect = !autostart;

  if (autostart) {
    connect(cachedBaseUrl, opts);
  } else {
    notifyStatus();
  }
}

/** Test teardown: clears session, listeners, socket. */
export function stopTunnel(): void {
  console.log('[tunnel] stopTunnel');
  started = false;
  manualDisconnect = false;
  cachedBaseUrl = null;
  cachedOpts = null;
  lastTunnelPublicUrl = null;
  if (appStateSub) {
    appStateSub.remove();
    appStateSub = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
  if (socket) {
    try {
      socket.close();
    } catch {}
    socket = null;
  }
  inflightTunnelByRequestId.clear();
  notifyStatus();
}

function connect(baseUrl: string, opts: StartTunnelOptions) {
  const url = tunnelSessionId ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}sessionId=${encodeURIComponent(tunnelSessionId)}` : baseUrl;

  console.log(`[tunnel] connecting...`);
  const ws = new WebSocket(url);
  socket = ws;
  notifyStatus();

  ws.onopen = () => {
    reconnectDelayMs = RECONNECT_INITIAL_MS;

    if (pingTimer) clearInterval(pingTimer);
    pingTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        sendJson(ws, { type: 'ping', ts: Date.now() });
      }
    }, PING_INTERVAL_MS);
    notifyStatus();
  };

  ws.onmessage = async (ev: MessageEvent) => {
    let msg: any;
    try {
      msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data));
    } catch {
      return;
    }

    if (msg.type === 'session_created' || msg.type === 'session_resumed') {
      const resumed = msg.type === 'session_resumed';
      const idChanged = msg.sessionId !== tunnelSessionId;
      if (idChanged) {
        tunnelSessionId = msg.sessionId;
        try {
          await AsyncStorage.setItem(STORAGE_KEY, msg.sessionId);
        } catch (err) {
          console.warn('[tunnel] failed to persist sessionId:', err);
        }
      }
      // Log only the truncated id; the full URL is a bearer credential and is
      // delivered to the caller via `onSessionChange` instead of stdout.
      console.log(`[tunnel] ${resumed ? 'resumed' : 'opened'} session ${msg.sessionId.slice(0, 8)} (pendingReplayed=${msg.pendingCount ?? 0}, idChanged=${idChanged})`);
      if (typeof msg.publicUrl === 'string') {
        lastTunnelPublicUrl = msg.publicUrl;
        notifyStatus();
      }
      opts.onSessionChange?.({ sessionId: msg.sessionId, publicUrl: msg.publicUrl, resumed, idChanged });
      return;
    }

    if (msg.type === 'pong') return;

    if (msg.type === 'http_request') {
      const hr = msg as TunnelHttpRequest;
      let work = inflightTunnelByRequestId.get(hr.requestId);
      if (!work) {
        work = (async (): Promise<TunnelHttpResponse> => {
          try {
            return await opts.handleRequest(hr);
          } catch (err: any) {
            console.warn('[tunnel] handler error:', err?.message ?? err);
            const body = `tunnel handler error: ${err?.message ?? err}`;
            return {
              type: 'http_response',
              requestId: hr.requestId,
              status: 500,
              headers: { 'content-type': 'text/plain' },
              bodyBase64: Buffer.from(body, 'utf8').toString('base64'),
            };
          }
        })();
        inflightTunnelByRequestId.set(hr.requestId, work);
        void work.finally(() => {
          inflightTunnelByRequestId.delete(hr.requestId);
        });
      }
      const resp = await work;
      console.log(`[tunnel] HTTP ${hr.method} → ${resp.status} (id=${hr.requestId})`);
      sendJson(wsForTunnelReply(ws), resp);
    }
  };

  ws.onerror = (err: any) => {
    console.warn('[tunnel] ws error:', err?.message ?? err);
  };

  ws.onclose = (ev: CloseEvent) => {
    // Ignore close from a socket we already replaced (race: old ws closes after new ws opened).
    if (socket !== ws) return;
    console.log(`[tunnel] ws closed code=${ev?.code ?? '?'}`);
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
    socket = null;
    notifyStatus();
    if (!started || manualDisconnect) return;
    scheduleReconnect(baseUrl, opts);
  };
}

function scheduleReconnect(baseUrl: string, opts: StartTunnelOptions) {
  if (reconnectTimer) return;
  const delay = reconnectDelayMs;
  reconnectDelayMs = Math.min(RECONNECT_MAX_MS, reconnectDelayMs * 2);
  console.log(`[tunnel] reconnecting in ${delay}ms`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect(baseUrl, opts);
  }, delay);
}

function sendJson(ws: WebSocket, payload: unknown) {
  try {
    ws.send(JSON.stringify(payload));
  } catch (err) {
    console.warn('[tunnel] ws.send failed:', err);
  }
}
