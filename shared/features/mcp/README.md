# MCP feature

Exposes this wallet to external AI agents over the [Model Context Protocol](https://modelcontextprotocol.io/). The user pairs the wallet with an LLM by copying the public tunnel URL into their AI provider; the LLM then calls wallet tools (read balances, send Lightning payments, etc.) via JSON-RPC over HTTP.

All code in `shared/features/mcp/` is platform-agnostic. Each build target (`mobile`, `ext`, `desktop`) supplies the platform-specific pieces — storage, wallet runtime, toast notifications, analytics, app-lifecycle hook — via `McpCallDeps` / `AppLifecycle` (see `modules/mcp-deps.ts`). The MCP feature itself contains no `react-native`, `chrome.*`, or DOM imports.

## Layers

```
┌─────────────────────────────────────────────────────────────┐
│  External AI agent (Claude / GPT / etc.)                    │
└──────────────────────────┬──────────────────────────────────┘
                           │  HTTPS to layerz.me:4433/<sid>
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  mcp-websocket-tunnel (separate project / Bun server)       │
└──────────────────────────┬──────────────────────────────────┘
                           │  WebSocket frames: http_request / http_response
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  modules/tunnel.ts        — WS client, session persist,     │
│                             reconnect, AppLifecycle hook    │
├─────────────────────────────────────────────────────────────┤
│  modules/mcp.ts           — MCP HTTP handler:               │
│                             session map, init / re-init,    │
│                             per-session POST serialization  │
├─────────────────────────────────────────────────────────────┤
│  modules/mcp-calls.ts     — Wallet tool surface             │
│                             (list_networks, transfer_token, │
│                              pay_lightning_invoice, …)      │
└─────────────────────────────────────────────────────────────┘
```

The three module layers are deliberately decoupled:

- **`tunnel.ts`** knows nothing about MCP — it's a generic WebSocket request/reply transport. If a second feature ever needs tunneling, hoist this out of `features/mcp/`.
- **`mcp.ts`** is the MCP-over-HTTP adapter. Manages `McpServer` instances keyed by `Mcp-Session-Id`, handles the synthetic-initialize dance for resumed/zombie sessions, and serializes POSTs per session so a slow `pay_lightning_invoice` doesn't block its own session's other calls (but stays concurrent with other clients).
- **`mcp-calls.ts`** is the wallet's tool surface. Each `mcp.registerTool(...)` is one capability exposed to the LLM.

## Layout

```
shared/features/mcp/
├── README.md                 ← this file
└── modules/
    ├── mcp.ts                ← HTTP handler + session lifecycle; `configureMcp(deps)` wires the platform
    ├── mcp-calls.ts          ← Tool registrations (the wallet API surface); `registerWalletMcpCalls(mcp, deps)`
    ├── tunnel.ts             ← WebSocket client + auto-reconnect; `startTunnel({ storage, appLifecycle, … })`
    ├── tunnel-types.ts       ← Wire types (`TunnelHttpRequest`, `TunnelHttpResponse`) — kept separate so the cross-process parity test can read them without dragging tunnel.ts
    ├── mcp-deps.ts           ← `McpCallDeps`, `AppLifecycle` — types every platform implements
    ├── mcp-activity-log.ts   ← In-memory store for the last 5 actions (UI; pure)
    └── mcp-constants.ts      ← MCP-only constants (e.g. lightning fee cap)
```

Platforms keep their UI components and platform-deps wire-up in their own tree (e.g. `mobile/src/features/mcp/components/`, `mobile/src/features/mcp/modules/mcp-platform.ts`).

## Lifecycle (mobile reference)

1. Platform boot wires `configureMcp(mobileMcpDeps)` synchronously (before any MCP request).
2. `app/_layout.tsx` mounts `<TunnelBootstrap/>` which calls `startTunnel({ storage, appLifecycle, handleRequest: handleMcpRequest, onSessionChange })` once.
3. `startTunnel` reads the persisted auto-start flag via `storage`. If the user previously tapped **play**, it connects immediately; otherwise it stays paused.
4. On connect, the tunnel server sends `session_created` or `session_resumed`. The public URL is stored and broadcast via `subscribeTunnelConnection` so the UI updates.
5. **Critical contract:** when `idChanged === true` in `onSessionChange` (server lost our session id), the platform calls `resetMcpSessions()` to drop all `McpServer` instances. Otherwise the LLM sees `Mcp-Session-Id` mismatches.
6. Every incoming `http_request` is dispatched to `handleMcpRequest` → routed to the right `McpServer` instance → tool handler → response back over the same WebSocket.

## Wiring a new platform

A new build target needs:

1. An `IStorage` implementation (key/value).
2. An `IBackgroundCaller` implementation (wallet runtime — `lazyInitWallet`, …).
3. (Optional) a way to show a toast / success notice (mobile uses `react-native-toast-message`; ext could use a different mechanism or no-op).
4. (Optional) an `AppLifecycle` that fires when the app comes back to foreground (mobile wraps `AppState`; desktop could wrap `document.visibilitychange`; ext typically omits — auto-reconnect handles the rest).

Then at boot:

```ts
import { configureMcp } from '@shared/features/mcp/modules/mcp';
import { handleMcpRequest, resetMcpSessions } from '@shared/features/mcp/modules/mcp';
import { startTunnel } from '@shared/features/mcp/modules/tunnel';

configureMcp({
  storage: PlatformStorage,
  backgroundCaller: PlatformBackgroundCaller,
  showSuccessToast: (summary, detail) => {
    /* platform toast */
  },
  trackToolCall: (toolName) => {
    /* platform analytics */
  },
});

void startTunnel({
  storage: PlatformStorage,
  appLifecycle: PlatformAppLifecycle, // optional
  handleRequest: handleMcpRequest,
  onSessionChange: ({ idChanged }) => {
    if (idChanged) resetMcpSessions();
  },
});
```

## Adding a new MCP tool

Open `modules/mcp-calls.ts`. Inside `registerWalletMcpCalls(mcp, deps)`, add:

```ts
mcp.registerTool(
  'tool_name',
  {
    title: 'Short title shown in some clients',
    description: 'What it does and how to call it. The LLM reads this — be specific about inputs, outputs, units, and which `network` ids are valid.',
    inputSchema: {
      // zod schemas; keep them narrow (enums where possible).
      network: z.enum(['spark', 'arkade']).describe('Network id ...'),
      amount: mcpPositiveBaseUnitsString.describe('Amount in smallest units, e.g. "1000000".'),
    },
  },
  async ({ network, amount }) => {
    mcpCallLog(`tool_name: start - network=${network} amount=${amount}`);
    trackMcpCall(deps, 'tool_name');
    try {
      const result = await doTheWork(network, amount);
      mcpCallLog(`tool_name: ok`);
      showMcpSuccess(deps, 'Did the thing', `on ${network}`);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      mcpCallLog(`tool_name: error - ${message}`);
      return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: message }) }] };
    }
  }
);
```

Conventions:

- **Always** call `mcpCallLog` on entry, success, and every error path. Logs are prefixed `[mcp-call]` and are essential for debugging an agent's confusing output.
- **Always** call `showMcpSuccess(deps, summary, detail?)` on success — it both pushes the activity-log line (shared) and surfaces a platform-native notice (mobile toast; ext/desktop may noop or use a different mechanism).
- Return shape is fixed: `{ content: [{ type: 'text', text: <stringified-json> }] }` on success, plus `isError: true` on failure.
- All amounts cross the wire as **smallest-unit integer strings** (e.g. satoshis, not BTC). Use `mcpPositiveBaseUnitsString` and let the LLM resolve decimals via `get_network_balance` (returns `decimals`).
- Wallets always use `MCP_BALANCE_ACCOUNT_NUMBER` from `@shared/hooks/AccountNumberContext` (4141) — the dedicated MCP pocket. Don't read the user's current `accountNumber` context.
- The `network` argument is always **mainnet-only** for the user-facing surface (`mcpListableNetworks()` filters testnets / lightning aliases / USDT).

## Security model

- The tunnel URL **is** the bearer credential. Anyone with it can call every tool registered here. The platform UI must warn the user accordingly.
- POST requests are serialized per `Mcp-Session-Id`, so a single LLM client can't race itself, but the wallet does not authenticate the caller. Future work: per-session capability scoping.
- `resetMcpSessions()` is the only way to revoke. Currently called only on tunnel `idChanged`, not on user pause — paused tunnel just stops accepting traffic.

## Related code

- Server: separate `mcp-websocket-tunnel/` repo (Bun + WebSocket). Keep `TunnelHttpRequest` / `TunnelHttpResponse` in `tunnel-types.ts` in sync with `server.ts` — the parity test (`shared/tests/unit-vi/tunnel-types-parity.test.ts`) catches drift.
- Crypto polyfill: mobile's `entry.js` adds `crypto.randomUUID` on Hermes; MCP session ids depend on it. Other platforms must ensure `crypto.randomUUID` is available.
- Toast styling (mobile): `mobile/components/toast-config.tsx` defines the dark `mcpAiSuccess` type.
