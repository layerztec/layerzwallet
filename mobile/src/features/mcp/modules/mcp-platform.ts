/**
 * Mobile-specific MCP platform wire-up.
 *
 * Shared MCP code (`@shared/features/mcp/modules/...`) is platform-agnostic;
 * this file plugs in the React Native pieces:
 *
 *   - `LayerzStorage` (AsyncStorage wrapper) for tunnel session persistence + (indirectly) tool storage.
 *   - `BackgroundExecutor` for `lazyInitWallet` / wallet runtime.
 *   - `Toast` (react-native-toast-message) for `mcpAiSuccess` notices.
 *   - `AppState` for "app foregrounded" reconnect.
 *   - Aptabase analytics for tool-call tracking.
 *
 * Exports are consumed by `mobile/app/_layout.tsx` (configureMcp + startTunnel).
 */

import { AppState, type AppStateStatus } from 'react-native';
import Toast from 'react-native-toast-message';

import { LayerzStorage } from '@/src/class/layerz-storage';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { trackAnalyticsEvent } from '@/src/modules/analytics';
import { AnalyticsEvents } from '@shared/types/analytics';

import type { AppLifecycle, McpCallDeps } from '@shared/features/mcp/modules/mcp-deps';

export const mobileMcpDeps: McpCallDeps = {
  storage: LayerzStorage,
  backgroundCaller: BackgroundExecutor,
  showSuccessToast: (summary, detail) => {
    Toast.show({
      type: 'mcpAiSuccess',
      text1: `AI action: ${summary}`,
      ...(detail ? { text2: detail } : {}),
      position: 'top',
      visibilityTime: 5500,
    });
  },
  trackToolCall: (toolName) => {
    trackAnalyticsEvent(AnalyticsEvents.McpCall, { tool_name: toolName });
  },
};

/**
 * Wraps `react-native`'s `AppState` so the shared tunnel module can reconnect
 * the instant the user returns to the app — without importing `react-native`
 * itself.
 */
export const mobileAppLifecycle: AppLifecycle = {
  onForeground(callback) {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') callback();
    });
    return () => sub.remove();
  },
};
