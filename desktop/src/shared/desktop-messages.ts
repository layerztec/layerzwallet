import type { RPCSchema } from 'electrobun/bun';

/**
 * Renderer ↔ Bun message contract for desktop-native operations.
 *
 * Mirrors ext's `MessageType` / `MessageTypeMap`: the renderer (CEF) sends a generic
 * `(type, params)` message over the Electrobun RPC channel, and the Bun-side
 * `background-message-controller` dispatches it. Currently only storage crosses the
 * boundary (CEF does not persist `views://` localStorage on Linux); add new message
 * types here to extend the bus (e.g. file dialogs, deep links).
 */
export enum DesktopMessageType {
  STORAGE_GET_ITEM,
  STORAGE_SET_ITEM,
  STORAGE_CLEAR,
}

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
    requests: Record<string, never>;
    messages: Record<string, never>;
  }>;
};
