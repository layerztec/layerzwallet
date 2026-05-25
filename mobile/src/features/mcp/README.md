# MCP feature

Exposes this wallet to external AI agents over the [Model Context Protocol](https://modelcontextprotocol.io/). The user pairs the wallet with an LLM by copying the public tunnel URL into their AI provider; the LLM then calls wallet tools (read balances, send Lightning payments, etc.) via JSON-RPC over HTTP.

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
│                             reconnect, AppState handling    │
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

- **`tunnel.ts`** knows nothing about MCP — it's a generic WebSocket request/reply transport. If a second feature ever needs tunneling, hoist this out to `src/lib/`.
- **`mcp.ts`** is the MCP-over-HTTP adapter. Manages `McpServer` instances keyed by `Mcp-Session-Id`, handles the synthetic-initialize dance for resumed/zombie sessions, and serializes POSTs per session so a slow `pay_lightning_invoice` doesn't block its own session's other calls (but stays concurrent with other clients).
- **`mcp-calls.ts`** is the wallet's tool surface. Each `mcp.registerTool(...)` is one capability exposed to the LLM.

## Layout

```
features/mcp/
├── README.md                 ← this file
├── components/
│   ├── McpTunnelStatusRow.tsx ← Home-screen pill (status + play/pause + activity log)
│   └── McpTunnelUrlModal.tsx  ← Bottom-sheet showing the pairing URL
└── modules/
    ├── mcp.ts                ← HTTP handler + session lifecycle
    ├── mcp-calls.ts          ← Tool registrations (the wallet API surface)
    ├── tunnel.ts             ← WebSocket client + auto-reconnect
    ├── mcp-activity-log.ts   ← In-memory store for the last 5 actions (UI)
    └── mcp-constants.ts      ← MCP-only constants (e.g. lightning fee cap)
```

`components/toast-config.tsx` lives at app-level `mobile/components/` — it's shared across features.

The route file `mobile/app/McpTunnelUrlModal.tsx` is a 3-line re-export stub; expo-router needs the route inside `app/`, the implementation lives here.

## Lifecycle

1. `app/_layout.tsx` mounts `<TunnelBootstrap/>` which calls `startTunnel({ handleRequest: handleMcpRequest, onSessionChange })` once.
2. `startTunnel` reads the persisted auto-start flag from AsyncStorage. If the user previously tapped **play**, it connects immediately; otherwise it stays paused.
3. On connect, the tunnel server sends `session_created` or `session_resumed`. The public URL is stored and broadcast via `subscribeTunnelConnection` so the UI updates.
4. **Critical contract:** when `idChanged === true` in `onSessionChange` (server lost our session id), `_layout.tsx` calls `resetMcpSessions()` to drop all `McpServer` instances. Otherwise the LLM sees `Mcp-Session-Id` mismatches.
5. Every incoming `http_request` is dispatched to `handleMcpRequest` → routed to the right `McpServer` instance → tool handler → response back over the same WebSocket.

## Adding a new MCP tool

Open `modules/mcp-calls.ts`. Inside `registerWalletMcpCalls(mcp)`, add:

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
    try {
      const result = await doTheWork(network, amount);
      mcpCallLog(`tool_name: ok`);
      showMcpSuccessToast('Did the thing', `on ${network}`);
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
- **Always** call `showMcpSuccessToast(summary, detail?)` on success — it both shows the user-visible dark toast (`type: 'mcpAiSuccess'`) and pushes the activity-log line under the Home status row. The toast is the user's only signal that the LLM did something.
- Return shape is fixed: `{ content: [{ type: 'text', text: <stringified-json> }] }` on success, plus `isError: true` on failure.
- All amounts cross the wire as **smallest-unit integer strings** (e.g. satoshis, not BTC). Use `mcpPositiveBaseUnitsString` and let the LLM resolve decimals via `get_network_balance` (returns `decimals`).
- Wallets always use `MCP_BALANCE_ACCOUNT_NUMBER` from `@shared/hooks/AccountNumberContext` (4141) — the dedicated MCP pocket. Don't read the user's current `accountNumber` context.
- The `network` argument is always **mainnet-only** for the user-facing surface (`mcpListableNetworks()` filters testnets / lightning aliases / USDT).

## Security model

- The tunnel URL **is** the bearer credential. Anyone with it can call every tool registered here. The modal warns the user accordingly.
- POST requests are serialized per `Mcp-Session-Id`, so a single LLM client can't race itself, but the wallet does not authenticate the caller. Future work: per-session capability scoping.
- `resetMcpSessions()` is the only way to revoke. Currently called only on tunnel `idChanged`, not on user pause — paused tunnel just stops accepting traffic.

## Related code

- Server: separate `mcp-websocket-tunnel/` repo (Bun + WebSocket). Keep `TunnelHttpRequest` / `TunnelHttpResponse` types in sync — they're duplicated by design.
- Crypto polyfill: `mobile/entry.js` adds `crypto.randomUUID` on Hermes; MCP session ids depend on it.
- Toast styling: `mobile/components/toast-config.tsx` defines the dark `mcpAiSuccess` type.
