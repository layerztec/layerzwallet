import { Utils } from 'electrobun/bun';

import { DesktopMessageType, type DesktopMessage } from '../shared/desktop-messages';
import { desktopStorage } from './desktop-storage';
import { startLocalMcpServer, stopLocalMcpServer } from './local-mcp-server';

/**
 * Bun-side dispatcher for renderer messages — the desktop analog of ext's
 * `background-message-controller.handleMessage`. Wired into the single Electrobun
 * `processMessage` RPC handler in `index.ts`.
 */
export async function handleMessage(message: DesktopMessage): Promise<unknown> {
  switch (message.type) {
    case DesktopMessageType.STORAGE_GET_ITEM:
      return desktopStorage.getItem(message.params[0]);

    case DesktopMessageType.STORAGE_SET_ITEM:
      await desktopStorage.setItem(message.params[0], message.params[1]);
      return null;

    case DesktopMessageType.STORAGE_CLEAR:
      await desktopStorage.clear();
      return null;

    case DesktopMessageType.SHOW_NOTIFICATION:
      Utils.showNotification(message.params[0]);
      return null;

    case DesktopMessageType.MCP_LOCAL_SERVER_START:
      return startLocalMcpServer();

    case DesktopMessageType.MCP_LOCAL_SERVER_STOP:
      stopLocalMcpServer();
      return null;

    default: {
      const exhaustive: never = message;
      throw new Error(`Unknown desktop message: ${JSON.stringify(exhaustive)}`);
    }
  }
}
