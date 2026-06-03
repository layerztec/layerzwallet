import type { RPCSchema } from "electrobun/bun";

/** Typed RPC for renderer ↔ Bun key/value storage (CEF-safe persistence). */
export type DesktopAppRPC = {
  bun: RPCSchema<{
    requests: {
      storageGetItem: { params: { key: string }; response: string };
      storageSetItem: {
        params: { key: string; value: string };
        response: null;
      };
      storageClear: { params: Record<string, never>; response: null };
    };
    messages: Record<string, never>;
  }>;
  webview: RPCSchema<{
    requests: Record<string, never>;
    messages: Record<string, never>;
  }>;
};
