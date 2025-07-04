import { Eip1193CustomEventCallback, Eip1193CustomEventResponse } from '../types/eip1193-custom-event';
import { MessageTypeMap } from '../types/IBackgroundCaller';

export interface IMessengerAdapter {
  sendResponseToActiveTabsFromPopupToContentScript(message: Eip1193CustomEventResponse): Promise<void>;
  sendEventCallbackFromPopupToContentScript(message: Eip1193CustomEventCallback): Promise<void>;
  documentDispatchEvent(message: Eip1193CustomEventCallback): void;
  sendResponseFromContentScriptToContentScript(message: Eip1193CustomEventResponse): Promise<void>;
  sendGenericMessageToBackground<T extends keyof MessageTypeMap>(type: T, params: MessageTypeMap[T]['params']): Promise<MessageTypeMap[T]['response']>;
}

/**
 * Shared messenger that delegates to the platform-specific adapter.
 * Similar to BreezWallet, this provides a consistent interface across platforms.
 */
export const Messenger = {
  async sendResponseToActiveTabsFromPopupToContentScript(message: Eip1193CustomEventResponse): Promise<void> {
    return await globalThis.messengerAdapter.sendResponseToActiveTabsFromPopupToContentScript(message);
  },

  async sendEventCallbackFromPopupToContentScript(message: Eip1193CustomEventCallback): Promise<void> {
    return await globalThis.messengerAdapter.sendEventCallbackFromPopupToContentScript(message);
  },

  documentDispatchEvent(message: Eip1193CustomEventCallback): void {
    return globalThis.messengerAdapter.documentDispatchEvent(message);
  },

  async sendResponseFromContentScriptToContentScript(message: Eip1193CustomEventResponse): Promise<void> {
    return await globalThis.messengerAdapter.sendResponseFromContentScriptToContentScript(message);
  },

  sendGenericMessageToBackground<T extends keyof MessageTypeMap>(type: T, params: MessageTypeMap[T]['params']): Promise<MessageTypeMap[T]['response']> {
    return globalThis.messengerAdapter.sendGenericMessageToBackground(type, params);
  },
};
