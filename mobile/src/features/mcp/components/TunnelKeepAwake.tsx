import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useSyncExternalStore } from 'react';

import { getTunnelConnectionStatus, subscribeTunnelConnection } from '@shared/features/mcp/modules/tunnel';

const KEEP_AWAKE_TAG = 'mcp-tunnel';

/**
 * Keeps the screen awake while the MCP agent tunnel is live, so the device's
 * auto-sleep timer doesn't dim/lock the screen while the agent is reachable.
 *
 * "Live" covers both `connected` and `connecting`: while connecting the client is
 * actively (re)establishing the socket — e.g. after network flickering — and we
 * must not let the screen sleep mid-reconnect. The lock is released only on a real
 * `disconnected` (user pause / tunnel not started).
 *
 * Screen-only / foreground-only: this does not keep JS running once the app is
 * backgrounded or the user manually locks the device.
 */
export function TunnelKeepAwake() {
  const status = useSyncExternalStore(subscribeTunnelConnection, getTunnelConnectionStatus, getTunnelConnectionStatus);
  const active = status !== 'disconnected';

  useEffect(() => {
    if (!active) return;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [active]);

  return null;
}
