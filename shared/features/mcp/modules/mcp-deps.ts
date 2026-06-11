/**
 * Platform-injected dependencies for the MCP feature.
 *
 * Each platform (mobile, ext, desktop) wires its own `McpCallDeps` and
 * (optionally) `AppLifecycle`. Shared code never imports `react-native`,
 * `AsyncStorage`, `Toast`, or any `BackgroundExecutor`/`LayerzStorage`
 * concrete — it depends only on these interfaces.
 */

import type { IBackgroundCaller } from '../../../types/IBackgroundCaller';
import type { IStorage } from '../../../types/IStorage';

/**
 * Wallet-tool dependencies. Supplied once via `configureMcp(...)` (see `./mcp.ts`)
 * before the first MCP request arrives. Every tool handler in `mcp-calls.ts`
 * reads these to talk to the platform-specific storage / wallet runtime / UI.
 */
export type McpCallDeps = {
  /** Persistent key/value store (mobile: AsyncStorage; ext: chrome.storage.local; desktop: …). */
  storage: IStorage;
  /** Wallet runtime — `lazyInitWallet` and friends. */
  backgroundCaller: IBackgroundCaller;
  /**
   * Surface a user-visible success notice (mobile: toast). Activity-log push
   * is always performed inside `mcp-calls.ts`; this callback is purely for
   * platform-native chrome (toast / banner / system notification).
   */
  showSuccessToast?: (summary: string, detail?: string) => void;
  /** Analytics hook called on every tool invocation (`{ tool_name }` payload at the call site). */
  trackToolCall?: (toolName: string) => void;
};

/**
 * Optional platform-lifecycle hook. Mobile wraps `AppState` to wake the tunnel
 * the instant the app comes back from background. Ext/desktop typically don't
 * need this — auto-reconnect plus `WebSocket`'s own visibility handling is enough.
 */
export type AppLifecycle = {
  /** Subscribe to "app foregrounded" events. Returns an unsubscribe fn. */
  onForeground(callback: () => void): () => void;
};
