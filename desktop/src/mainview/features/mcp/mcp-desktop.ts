/**
 * Single desktop entry for `@shared/features/mcp/modules/mcp`.
 *
 * Both transports (public tunnel + local listener) reach the MCP handler through here,
 * so Vite can't duplicate the module and split the `configureMcp` singleton. Mirrors the
 * rationale in `tunnel-desktop.ts` / `mcp-activity-log-desktop.ts`. The shared module is
 * imported lazily so wallet/MCP code stays out of the boot bundle until MCP is used.
 */

import { ensureWalletAdapters } from '../../modules/load-adapters';

import { desktopMcpDeps } from './modules/mcp-platform';

import type { RequestHandler, TunnelHttpRequest, TunnelHttpResponse } from '@shared/features/mcp/modules/tunnel-types';

type McpModule = typeof import('@shared/features/mcp/modules/mcp');

let mcpModulePromise: Promise<McpModule> | null = null;
let configurePromise: Promise<void> | null = null;

function loadMcp(): Promise<McpModule> {
  if (!mcpModulePromise) mcpModulePromise = import('@shared/features/mcp/modules/mcp');
  return mcpModulePromise;
}

/** Idempotent: load wallet adapters and wire platform deps before any MCP request. */
export function ensureMcpConfigured(): Promise<void> {
  if (!configurePromise) {
    configurePromise = (async () => {
      await ensureWalletAdapters();
      const { configureMcp } = await loadMcp();
      configureMcp(desktopMcpDeps, { name: 'layerz-wallet-desktop' });
    })().catch((err) => {
      configurePromise = null;
      throw err;
    });
  }
  return configurePromise;
}

/** The request handler the public tunnel feeds (after deps are wired). */
export async function getMcpRequestHandler(): Promise<RequestHandler> {
  await ensureMcpConfigured();
  return (await loadMcp()).handleMcpRequest;
}

/** Renderer-side entry for the local listener — Bun calls this via the `mcpHandleHttp` RPC. */
export async function handleLocalMcpHttp(req: TunnelHttpRequest): Promise<TunnelHttpResponse> {
  await ensureMcpConfigured();
  return (await loadMcp()).handleMcpRequest(req);
}

export async function resetMcpSessions(): Promise<void> {
  (await loadMcp()).resetMcpSessions();
}
