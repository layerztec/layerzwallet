import { Eip1193CustomEventCallback, Eip1193CustomEventResponse } from '../types/eip1193-custom-event';
import { MessageTypeMap } from '../types/IBackgroundCaller';

export interface IMessenger {
  sendResponseToActiveTabsFromPopupToContentScript(message: Eip1193CustomEventResponse): Promise<void>;
  sendEventCallbackFromPopupToContentScript(message: Eip1193CustomEventCallback): Promise<void>;
  documentDispatchEvent(message: Eip1193CustomEventCallback): void;
  sendResponseFromContentScriptToContentScript(message: Eip1193CustomEventResponse): Promise<void>;
  sendGenericMessageToBackground<T extends keyof MessageTypeMap>(type: T, params: MessageTypeMap[T]['params']): Promise<MessageTypeMap[T]['response']>;
}
