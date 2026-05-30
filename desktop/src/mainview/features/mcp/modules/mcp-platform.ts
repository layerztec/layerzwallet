/**
 * Desktop-specific MCP platform wire-up.
 *
 * Consumed by `App.tsx` (`configureMcp` + `startTunnel`).
 */

import { LayerzStorage } from "../../../class/layerz-storage";
import { BackgroundCaller } from "../../../modules/background-caller";
import type {
  AppLifecycle,
  McpCallDeps,
} from "@shared/features/mcp/modules/mcp-deps";

export const desktopMcpDeps: McpCallDeps = {
  storage: LayerzStorage,
  backgroundCaller: BackgroundCaller,
  showSuccessToast: (summary, detail) => {
    const msg = detail
      ? `AI action: ${summary} — ${detail}`
      : `AI action: ${summary}`;
    console.log("[mcp]", msg);
  },
  trackToolCall: (toolName) => {
    console.log("[mcp] tool call:", toolName);
  },
};

/** Reconnect tunnel when the desktop window becomes visible again. */
export const desktopAppLifecycle: AppLifecycle = {
  onForeground(callback) {
    const onVisibility = () => {
      if (document.visibilityState === "visible") callback();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  },
};
