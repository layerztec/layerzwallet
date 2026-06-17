/**
 * Local MCP HTTP listener — the "closed circuit" alternative to the public tunnel.
 *
 * Runs in the Bun main process (the only context that can open a listening socket)
 * and forwards every request to the renderer's existing `handleMcpRequest` over the
 * Electrobun RPC channel. No traffic leaves the machine/LAN. This is the local analog
 * of `mcp-websocket-tunnel/server.ts`, minus sessions (a single in-process "device"
 * needs none of that).
 *
 * Security mirrors the tunnel: the URL carries an unguessable token (`/mcp/<token>`)
 * that acts as the bearer credential. The token is persisted so the URL is stable
 * across restarts, exactly like the tunnel's persisted session id.
 */

import { isIPv4 } from 'node:net';
import { networkInterfaces } from 'node:os';

import { desktopStorage } from './desktop-storage';
import type { LocalMcpServerInfo } from '../shared/desktop-messages';
import type { TunnelHttpRequest, TunnelHttpResponse } from '@shared/features/mcp/modules/tunnel-types';

type Forwarder = (req: TunnelHttpRequest) => Promise<TunnelHttpResponse>;

const HOST = '0.0.0.0';
const DEFAULT_PORT = 4435;
const PORT_SCAN_ATTEMPTS = 10;
/** Persisted bearer token so the local URL survives restarts (parallels the tunnel's session id). */
const TOKEN_STORAGE_KEY = '@layerz/mcp-local-token';

/** CORS so browser-based agents / MCP Inspector can reach the listener (mirrors the tunnel server). */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Authorization',
};

let forward: Forwarder | null = null;
let server: ReturnType<typeof Bun.serve> | null = null;
let serverPort = 0;
let serverToken = '';

/** Wire the renderer bridge once at boot (from index.ts, where the window/RPC exists). */
export function configureLocalMcpServer(forwarder: Forwarder): void {
  forward = forwarder;
}

/** 24 random bytes, base64url — same shape/strength as the tunnel server's session id. */
function randomToken(bytes = 24): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString('base64url');
}

async function getOrCreateToken(): Promise<string> {
  const existing = await desktopStorage.getItem(TOKEN_STORAGE_KEY);
  if (existing) return existing;
  const token = randomToken();
  await desktopStorage.setItem(TOKEN_STORAGE_KEY, token);
  return token;
}

function buildUrl(port: number, token: string): string {
  return `http://${lanAddress()}:${port}/mcp/${token}`;
}

/** First non-internal IPv4 so other machines on the LAN get a reachable URL; loopback otherwise. */
function lanAddress(): string {
  for (const addrs of Object.values(networkInterfaces())) {
    for (const addr of addrs ?? []) {
      // Detect IPv4 from the address itself: `addr.family` is `'IPv4'` on Bun but has been a
      // numeric `4` on some Node releases, so don't depend on its representation.
      if (!addr.internal && isIPv4(addr.address)) return addr.address;
    }
  }
  return '127.0.0.1';
}

function isAddrInUse(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === 'EADDRINUSE';
}

/** Idempotent: returns the existing listener's URL if running. The renderer serializes start/stop. */
export async function startLocalMcpServer(): Promise<LocalMcpServerInfo> {
  if (server) {
    return { url: buildUrl(serverPort, serverToken), port: serverPort };
  }
  const dispatch = forward;
  if (!dispatch) {
    throw new Error('[local-mcp] not configured: call configureLocalMcpServer() first');
  }

  const token = await getOrCreateToken();

  let lastErr: unknown;
  for (let i = 0; i < PORT_SCAN_ATTEMPTS; i++) {
    const port = DEFAULT_PORT + i;
    try {
      server = Bun.serve({
        hostname: HOST,
        port,
        async fetch(req, srv) {
          const url = new URL(req.url);

          // The token in the path is the bearer credential. Reject anything else
          // (404, not 401, so we don't confirm the endpoint exists to scanners).
          const match = url.pathname.match(/^\/mcp\/([^/]+)\/?$/);
          if (!match || match[1] !== token) {
            return new Response(JSON.stringify({ error: 'NOT_FOUND' }), {
              status: 404,
              headers: { 'content-type': 'application/json', ...CORS_HEADERS },
            });
          }

          if (req.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: { ...CORS_HEADERS, 'Access-Control-Max-Age': '86400' } });
          }

          // A slow tool (e.g. pay_lightning_invoice) can take minutes; don't let Bun's
          // idle cutoff kill the request while the renderer is working.
          srv.timeout(req, 0);

          const headers: Record<string, string> = {};
          req.headers.forEach((value, key) => {
            headers[key] = value;
          });

          const tunnelReq: TunnelHttpRequest = {
            type: 'http_request',
            requestId: crypto.randomUUID(),
            method: req.method,
            // Strip the token before handing to the MCP layer (it routes by method +
            // Mcp-Session-Id, not path) so the credential never reaches renderer logs.
            path: `/mcp${url.search}`,
            headers,
            bodyBase64: Buffer.from(await req.arrayBuffer()).toString('base64'),
          };

          let tunnelRes: TunnelHttpResponse;
          try {
            tunnelRes = await dispatch(tunnelReq);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return new Response(JSON.stringify({ error: message }), {
              status: 504,
              headers: { 'content-type': 'application/json', ...CORS_HEADERS },
            });
          }

          const responseHeaders = new Headers();
          for (const [key, value] of Object.entries(tunnelRes.headers)) {
            const lower = key.toLowerCase();
            if (lower === 'content-length' || lower === 'transfer-encoding' || lower === 'connection') continue;
            responseHeaders.set(key, value);
          }
          for (const [key, value] of Object.entries(CORS_HEADERS)) {
            responseHeaders.set(key, value);
          }

          return new Response(Buffer.from(tunnelRes.bodyBase64, 'base64'), {
            status: tunnelRes.status ?? 200,
            headers: responseHeaders,
          });
        },
      });

      serverPort = port;
      serverToken = token;
      console.log(`[local-mcp] listening on ${HOST}:${port}`);
      return { url: buildUrl(port, token), port };
    } catch (err) {
      lastErr = err;
      if (isAddrInUse(err)) continue;
      throw err;
    }
  }

  throw new Error(`[local-mcp] no free port in ${DEFAULT_PORT}-${DEFAULT_PORT + PORT_SCAN_ATTEMPTS - 1}: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
}

export function stopLocalMcpServer(): void {
  if (!server) return;
  console.log('[local-mcp] stopping');
  try {
    server.stop(true);
  } catch {
    // already torn down
  }
  server = null;
  serverPort = 0;
  serverToken = '';
}
