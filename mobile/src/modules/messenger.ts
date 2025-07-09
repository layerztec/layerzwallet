import { BrowserBridge } from '@/src/class/browser-bridge';
import { Eip1193CustomEventCallback, Eip1193CustomEventResponse } from '@shared/types/eip1193-custom-event';
import { MessageTypeMap } from '@shared/types/IBackgroundCaller';
import { IMessenger } from '@shared/modules/messenger';

/**
 * Mobile-specific messenger implementation that uses BrowserBridge for WebView communication.
 */
class MobileMessenger implements IMessenger {
  async sendResponseToActiveTabsFromPopupToContentScript() {
    throw new Error('sendResponseToActiveTabsFromPopupToContentScript not implemented in mobile context');
  }

  async sendEventCallbackFromPopupToContentScript() {
    // do nothing
  }

  documentDispatchEvent() {
    throw new Error('documentDispatchEvent not implemented in mobile context');
  }

  async sendResponseFromContentScriptToContentScript(message: Eip1193CustomEventResponse): Promise<void> {
    // This is the key method that uses browser bridge sendMessage as mentioned by the user
    const bridge = BrowserBridge.getInstance();
    if (bridge) {
      bridge.sendMessage(message);
    } else {
      console.warn('BrowserBridge not available for sendResponseFromContentScriptToContentScript');
    }
  }

  sendGenericMessageToBackground<T extends keyof MessageTypeMap>(type: T, params: MessageTypeMap[T]['params']): Promise<MessageTypeMap[T]['response']> {
    return Promise.reject(new Error('sendGenericMessageToBackground not implemented in mobile context'));
  }
}

export const Messenger = new MobileMessenger();
