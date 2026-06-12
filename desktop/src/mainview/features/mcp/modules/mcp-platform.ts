/**
 * Desktop-specific MCP platform wire-up.
 *
 * Consumed by `App.tsx` (`configureMcp` + `startTunnel`).
 */

import { LayerzStorage } from '../../../class/layerz-storage';
import { AnalyticsEvents } from '@shared/types/analytics';

import { trackAnalyticsEvent } from '../../../modules/analytics';
import { BackgroundCaller } from '../../../modules/background-caller';
import { showDesktopNotification } from '../../../modules/notifications';
import type { AppLifecycle, McpCallDeps } from '@shared/features/mcp/modules/mcp-deps';

export const desktopMcpDeps: McpCallDeps = {
  storage: LayerzStorage,
  backgroundCaller: BackgroundCaller,
  // Surface AI-driven actions as native OS notifications (mirrors mobile's toast),
  // so the user sees them even when the window is unfocused or minimized.
  showSuccessToast: (summary, detail) => {
    void showDesktopNotification({ title: `AI action: ${summary}`, body: detail });
  },
  trackToolCall: (toolName) => {
    console.log('[mcp] tool call:', toolName);
    trackAnalyticsEvent(AnalyticsEvents.McpCall, { tool_name: toolName });
  },
};

/** Reconnect tunnel when the desktop window becomes visible again. */
export const desktopAppLifecycle: AppLifecycle = {
  onForeground(callback) {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') callback();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  },
};
