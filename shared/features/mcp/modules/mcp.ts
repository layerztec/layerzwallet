/**
 * MCP over HTTP — session / transport / tunnel bridging (`handleMcpRequest`).
 *
 * Platform-specific deps (storage, wallet runtime, toast, analytics) flow in
 * via `configureMcp(deps)` which must be called once at app boot before any
 * tunnel traffic arrives. `mcp-calls.ts` reads those deps to invoke wallet
 * operations; this file knows nothing about the platform.
 *
 * MCP call surface: `./mcp-calls.ts`. Tunnel transport: `./tunnel.ts`.
 */

import { DEFAULT_NEGOTIATED_PROTOCOL_VERSION, isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import { registerWalletMcpCalls } from './mcp-calls';
import type { McpCallDeps } from './mcp-deps';
import { MCP_SERVER_INSTRUCTIONS } from './mcp-instructions';
import type { TunnelHttpRequest, TunnelHttpResponse } from './tunnel-types';

type McpInstance = {
  server: McpServer;
  transport: WebStandardStreamableHTTPServerTransport;
};

type ServerInfo = { name: string; version: string };

const DEFAULT_SERVER_INFO: ServerInfo = { name: 'layerz-wallet', version: '0.1.0' };

const mcpInstances = new Map<string, McpInstance>();

/** Sentinel key: headerless POSTs must share one stack (new transport per POST → "not initialized"). */
const BARE_KEY = '\0bare';

/**
 * Per-session POST chains. Keyed by client-supplied `Mcp-Session-Id` (or `BARE_KEY` for
 * headerless POSTs), so init/tools on one session can't overlap, but unrelated sessions
 * (e.g. a 180s `pay_lightning_invoice` on session A) don't block other clients' calls.
 */
const postChains = new Map<string, Promise<void>>();

let configuredDeps: McpCallDeps | null = null;
let configuredServerInfo: ServerInfo = DEFAULT_SERVER_INFO;

/**
 * Wire the platform-specific dependencies. Call **once** at app boot, before any
 * `handleMcpRequest` invocation. Subsequent calls overwrite (e.g. in tests).
 */
export function configureMcp(deps: McpCallDeps, serverInfo?: Partial<ServerInfo>): void {
  configuredDeps = deps;
  if (serverInfo) {
    configuredServerInfo = { ...DEFAULT_SERVER_INFO, ...serverInfo };
  }
}

function requireConfiguredDeps(): McpCallDeps {
  if (!configuredDeps) {
    throw new Error('[mcp] configureMcp(deps) must be called before handling MCP requests.');
  }
  return configuredDeps;
}

async function runPostSerialized<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = postChains.get(key) ?? Promise.resolve();
  const next = prev.then(() => fn());
  const tail = next.then(
    () => {},
    () => {}
  );
  postChains.set(key, tail);
  // Drop the entry once our tail settles, unless a later request already replaced it.
  void tail.finally(() => {
    if (postChains.get(key) === tail) postChains.delete(key);
  });
  return next;
}

function newMcpSessionId(): string {
  return crypto.randomUUID();
}

function isInitializeBody(parsed: unknown): boolean {
  if (parsed == null) return false;
  return Array.isArray(parsed) ? parsed.some((m) => isInitializeRequest(m)) : isInitializeRequest(parsed as never);
}

async function syntheticInitialize(instance: McpInstance, protocolVersion: string, path: string): Promise<void> {
  const msg = {
    jsonrpc: '2.0' as const,
    id: 0,
    method: 'initialize' as const,
    params: {
      protocolVersion,
      capabilities: {},
      clientInfo: { name: 'layerz', version: '0' },
    },
  };
  const url = `http://tunnel.local${path.startsWith('/') ? path : `/${path}`}`;
  const h = new Headers();
  h.set('content-type', 'application/json');
  // Streamable HTTP POST requires both media types (see SDK handlePostRequest).
  h.set('accept', 'application/json, text/event-stream');
  h.set('mcp-protocol-version', protocolVersion);
  const res = await instance.transport.handleRequest(new Request(url, { method: 'POST', headers: h, body: JSON.stringify(msg) }), { parsedBody: msg });
  const payload = Buffer.from(await res.arrayBuffer())
    .toString('utf8')
    .slice(0, 400);
  if (!res.ok) {
    console.warn(`[mcp] synthetic initialize HTTP ${res.status}: ${payload}`);
    throw new Error(`synthetic MCP initialize failed (${res.status})`);
  }
  if (!instance.transport.sessionId) {
    throw new Error('synthetic MCP initialize did not mint session id');
  }
}

function buildMcpServer(): McpServer {
  const deps = requireConfiguredDeps();
  const mcp = new McpServer(configuredServerInfo, {
    capabilities: { tools: {} },
    instructions: MCP_SERVER_INSTRUCTIONS,
  });
  registerWalletMcpCalls(mcp, deps);
  return mcp;
}

async function createAndConnectNewMcpInstance(): Promise<McpInstance> {
  let instance!: McpInstance;
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: newMcpSessionId,
    enableJsonResponse: true,
    onsessioninitialized: (newSid: string) => {
      mcpInstances.set(newSid, instance);
      console.log(`[mcp] session ${newSid.slice(0, 8)} initialized (${mcpInstances.size} active)`);
    },
    onsessionclosed: (closedSid: string) => {
      for (const [k, v] of [...mcpInstances.entries()]) {
        if (v.transport.sessionId === closedSid) mcpInstances.delete(k);
      }
    },
  });
  const server = buildMcpServer();
  instance = { server, transport };
  await server.connect(transport);
  return instance;
}

/** Clear all MCP stacks (e.g. tunnel session id rotated). */
export function resetMcpSessions(): void {
  if (mcpInstances.size === 0) return;
  console.log(`[mcp] reset ${mcpInstances.size} session key(s)`);
  for (const inst of new Set(mcpInstances.values())) {
    try {
      void inst.transport.close();
    } catch {}
    try {
      void inst.server.close();
    } catch {}
  }
  mcpInstances.clear();
}

/** Remove every map entry pointing at `inst`, then close server/transport. */
function evictMcpInstance(inst: McpInstance): void {
  for (const [k, v] of [...mcpInstances.entries()]) {
    if (v === inst) mcpInstances.delete(k);
  }
  try {
    void inst.transport.close();
  } catch {}
  try {
    void inst.server.close();
  } catch {}
}

export async function handleMcpRequest(msg: TunnelHttpRequest): Promise<TunnelHttpResponse> {
  const lowerHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(msg.headers ?? {})) {
    lowerHeaders[k.toLowerCase()] = v;
  }

  const clientMcpSid = lowerHeaders['mcp-session-id'];
  const path = msg.path.startsWith('/') ? msg.path : `/${msg.path}`;
  const protocolVersion = lowerHeaders['mcp-protocol-version'] ?? DEFAULT_NEGOTIATED_PROTOCOL_VERSION;

  const zombieSid = !!(clientMcpSid && !mcpInstances.has(clientMcpSid));
  const barePost = !clientMcpSid && msg.method === 'POST';

  const url = `http://tunnel.local${path}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(msg.headers ?? {})) {
    const lk = k.toLowerCase();
    if (lk === 'host' || lk === 'content-length' || lk === 'connection') continue;
    try {
      headers.set(k, v);
    } catch {
      // skip invalid header values rather than failing the whole request
    }
  }

  let body: BodyInit | undefined;
  let parsedBody: unknown | undefined;
  if (msg.method !== 'GET' && msg.method !== 'HEAD' && msg.bodyBase64) {
    const text = Buffer.from(msg.bodyBase64, 'base64').toString('utf8');
    body = text;
    const trimmed = text.trimStart();
    const ct = headers.get('content-type') ?? '';
    if (ct.includes('application/json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        parsedBody = JSON.parse(text);
      } catch {
        // transport will JSON-RPC-parse from raw body where needed
      }
    }
  }

  const isInit = parsedBody !== undefined && isInitializeBody(parsedBody);

  /** Serialize POSTs per session so init/tools can't overlap on the same stack; unrelated sessions stay concurrent. */
  if (msg.method === 'POST') {
    const chainKey = clientMcpSid ?? BARE_KEY;
    return runPostSerialized(chainKey, async () => {
      // Headerless `initialize` must always get a fresh transport. Otherwise a
      // second smoke run (or any client) reuses BARE_KEY + an already-initialized
      // stack and the SDK may omit `Mcp-Session-Id` — curl scripts break.
      if (barePost && isInit) {
        const existingBare = mcpInstances.get(BARE_KEY);
        if (existingBare) {
          evictMcpInstance(existingBare);
        }
        const b = await createAndConnectNewMcpInstance();
        mcpInstances.set(BARE_KEY, b);
      } else if (barePost && !mcpInstances.has(BARE_KEY)) {
        const b = await createAndConnectNewMcpInstance();
        mcpInstances.set(BARE_KEY, b);
      }

      let inst = clientMcpSid ? mcpInstances.get(clientMcpSid) : mcpInstances.get(BARE_KEY);

      if (zombieSid && !inst && isInit) {
        inst = await createAndConnectNewMcpInstance();
      }

      if (zombieSid && !inst && !isInit && clientMcpSid) {
        if (!mcpInstances.has(clientMcpSid)) {
          const z = await createAndConnectNewMcpInstance();
          await syntheticInitialize(z, protocolVersion, path);
          mcpInstances.set(clientMcpSid, z);
        }
        inst = mcpInstances.get(clientMcpSid);
      }

      if (!inst) {
        console.warn(`[mcp] POST → 404 (no MCP instance)`);
        return {
          type: 'http_response',
          requestId: msg.requestId,
          status: 404,
          headers: { 'content-type': 'application/json' },
          bodyBase64: Buffer.from(JSON.stringify({ error: 'unknown Mcp-Session-Id' }), 'utf8').toString('base64'),
        };
      }

      if (!isInit && !inst.transport.sessionId) {
        await syntheticInitialize(inst, protocolVersion, path);
        if (zombieSid && clientMcpSid) {
          mcpInstances.set(clientMcpSid, inst);
        }
      }

      if (zombieSid && clientMcpSid && isInit) {
        headers.delete('mcp-session-id');
      } else if (!isInit && inst.transport.sessionId) {
        headers.set('mcp-session-id', inst.transport.sessionId);
        headers.set('mcp-protocol-version', protocolVersion);
      }

      const req = new Request(url, { method: msg.method, headers, body });
      const res = await inst.transport.handleRequest(req, { parsedBody });

      if (zombieSid && clientMcpSid && isInit && inst.transport.sessionId) {
        mcpInstances.set(clientMcpSid, inst);
      }

      const respHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        respHeaders[key] = value;
      });

      const respBuf = Buffer.from(await res.arrayBuffer());

      return {
        type: 'http_response',
        requestId: msg.requestId,
        status: res.status,
        headers: respHeaders,
        bodyBase64: respBuf.toString('base64'),
      };
    });
  }

  const instance = clientMcpSid ? mcpInstances.get(clientMcpSid) : undefined;
  if (!instance) {
    console.warn(`[mcp] ${msg.method} unknown session → 404`);
    return {
      type: 'http_response',
      requestId: msg.requestId,
      status: 404,
      headers: { 'content-type': 'application/json' },
      bodyBase64: Buffer.from(JSON.stringify({ error: 'unknown Mcp-Session-Id' }), 'utf8').toString('base64'),
    };
  }

  const req = new Request(url, { method: msg.method, headers, body });
  const res = await instance.transport.handleRequest(req, { parsedBody });

  const respHeaders: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    respHeaders[key] = value;
  });

  const respBuf = Buffer.from(await res.arrayBuffer());

  return {
    type: 'http_response',
    requestId: msg.requestId,
    status: res.status,
    headers: respHeaders,
    bodyBase64: respBuf.toString('base64'),
  };
}
