import type { RPCSchema } from 'electrobun/bun';

import type { TunnelHttpRequest, TunnelHttpResponse } from '@shared/features/mcp/modules/tunnel-types';

/**
 * Renderer ↔ Bun message contract for desktop-native operations.
 *
 * Mirrors ext's `MessageType` / `MessageTypeMap`: the renderer (CEF) sends a generic
 * `(type, params)` message over the Electrobun RPC channel, and the Bun-side
 * `background-message-controller` dispatches it. Currently storage, notifications, and
 * the local MCP server toggle cross the boundary; add new message types here to extend
 * the bus (e.g. file dialogs, deep links).
 */
export enum DesktopMessageType {
  STORAGE_GET_ITEM,
  STORAGE_SET_ITEM,
  STORAGE_CLEAR,
  SHOW_NOTIFICATION,
  /** Start the loopback/LAN MCP HTTP listener (local "closed circuit" mode). */
  MCP_LOCAL_SERVER_START,
  /** Stop the local MCP HTTP listener. */
  MCP_LOCAL_SERVER_STOP,
}

/** What the Bun side reports back after starting the local MCP server. */
export type LocalMcpServerInfo = {
  /** Address to paste into a local agent, e.g. `http://192.168.1.10:4435/mcp`. */
  url: string;
  port: number;
};

/** Native OS notification options (subset of Electrobun's `Utils.NotificationOptions`). */
export type DesktopNotificationOptions = {
  title: string;
  body?: string;
  subtitle?: string;
  silent?: boolean;
};

export type DesktopMessageTypeMap = {
  [DesktopMessageType.STORAGE_GET_ITEM]: {
    params: [key: string];
    response: string;
  };
  [DesktopMessageType.STORAGE_SET_ITEM]: {
    params: [key: string, value: string];
    response: null;
  };
  [DesktopMessageType.STORAGE_CLEAR]: { params: []; response: null };
  [DesktopMessageType.SHOW_NOTIFICATION]: {
    params: [options: DesktopNotificationOptions];
    response: null;
  };
  [DesktopMessageType.MCP_LOCAL_SERVER_START]: { params: []; response: LocalMcpServerInfo };
  [DesktopMessageType.MCP_LOCAL_SERVER_STOP]: { params: []; response: null };
};

/** Discriminated envelope crossing the RPC channel. */
export type DesktopMessage = {
  [K in keyof DesktopMessageTypeMap]: {
    type: K;
    params: DesktopMessageTypeMap[K]['params'];
  };
}[keyof DesktopMessageTypeMap];

/**
 * Single generic Electrobun request method (the analog of `chrome.runtime.sendMessage`).
 * Per-message typing lives in `DesktopMessageTypeMap`, not in this schema.
 */
export type DesktopAppRPC = {
  bun: RPCSchema<{
    requests: {
      processMessage: { params: DesktopMessage; response: unknown };
    };
    messages: Record<string, never>;
  }>;
  webview: RPCSchema<{
    requests: {
      /** Bun → renderer: hand an HTTP request from the local MCP listener to the wallet's MCP handler. */
      mcpHandleHttp: { params: TunnelHttpRequest; response: TunnelHttpResponse };
    };
    messages: Record<string, never>;
  }>;
};
