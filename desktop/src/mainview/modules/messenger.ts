import { Electroview } from 'electrobun/view';

import type { IMessenger } from '@shared/modules/messenger';
import type { DesktopAppRPC, DesktopMessage, DesktopMessageTypeMap } from '../../shared/desktop-messages';

type DesktopRpc = ReturnType<typeof Electroview.defineRPC<DesktopAppRPC>>;

/**
 * Desktop messenger — the single transport object, mirroring ext's `ExtensionMessenger`.
 *
 * - EIP-1193 dApp-event methods are no-ops: desktop has no in-page provider.
 * - `sendGenericMessageToBackground` throws: wallet ops run locally in the renderer
 *   (`BackgroundExecutor`), so there is no background wallet messaging.
 * - `send()` is the renderer→Bun transport (the analog of `chrome.runtime.sendMessage`).
 *   It owns the lazy `Electroview` RPC singleton, which must exist before any storage
 *   access (CEF does not persist `views://` localStorage on Linux).
 */
class DesktopMessenger implements IMessenger {
  private rpc: DesktopRpc | null = null;

  private getRpc(): DesktopRpc {
    if (!this.rpc) {
      const rpc = Electroview.defineRPC<DesktopAppRPC>({
        handlers: {
          requests: {
            // Bun's local MCP listener forwards each HTTP request here. Lazy-import the
            // MCP handler so wallet/MCP code stays out of the boot bundle until used.
            mcpHandleHttp: async (req) => {
              const { handleLocalMcpHttp } = await import('../features/mcp/mcp-desktop');
              return handleLocalMcpHttp(req);
            },
          },
          messages: {},
        },
      });
      new Electroview({ rpc });
      this.rpc = rpc;
    }
    return this.rpc;
  }

  async sendResponseToActiveTabsFromPopupToContentScript() {}
  async sendEventCallbackFromPopupToContentScript() {}
  documentDispatchEvent() {}
  async sendResponseFromContentScriptToContentScript() {}

  async sendGenericMessageToBackground(): Promise<never> {
    throw new Error('Desktop wallet does not use background messaging');
  }

  /** Renderer→Bun transport for desktop-native messages (currently storage). */
  async send<T extends keyof DesktopMessageTypeMap>(type: T, params: DesktopMessageTypeMap[T]['params']): Promise<DesktopMessageTypeMap[T]['response']> {
    const response = await this.getRpc().request.processMessage({
      type,
      params,
    } as DesktopMessage);
    return response as DesktopMessageTypeMap[T]['response'];
  }
}

export const Messenger = new DesktopMessenger();
