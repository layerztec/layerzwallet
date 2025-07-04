import { Eip1193CustomEventCallback, Eip1193CustomEventResponse } from '@shared/types/eip1193-custom-event';
import { MessageTypeMap } from '@shared/types/IBackgroundCaller';
import { IMessengerAdapter } from '@shared/modules/messenger';

/**
 * Extension-specific messenger implementation that uses Chrome APIs.
 */
class ExtensionMessenger implements IMessengerAdapter {
  async sendResponseToActiveTabsFromPopupToContentScript(message: Eip1193CustomEventResponse): Promise<void> {
    chrome.tabs.query({ active: true }, function (tabs) {
      // Send message to all active tabs since the target dapp is likely among them
      tabs.map(
        (tab) =>
          typeof tab.id !== 'undefined' &&
          chrome.tabs.sendMessage(tab.id, message, function (_response: any) {
            // Response handling not needed
          })
      );
    });
  }

  async sendEventCallbackFromPopupToContentScript(message: Eip1193CustomEventCallback): Promise<void> {
    console.log('Broadcasting event to the Dapp:', message);
    chrome.tabs.query({ active: true }, function (tabs) {
      // Send message to all active tabs since the target dapp is likely among them
      tabs.map(
        (tab) =>
          typeof tab.id !== 'undefined' &&
          chrome.tabs.sendMessage(tab.id, message, function (response: any) {
            if (response) {
              console.debug('Response from content script:', response);
            }
          })
      );
    });
  }

  documentDispatchEvent(message: Eip1193CustomEventCallback): void {
    console.log('Dispatching event to the Dapp:', message);
    document.dispatchEvent(
      new CustomEvent('LayerzWalletExtension', {
        // Serialize message to JSON string to prevent Firefox security violations when passing complex objects
        detail: JSON.stringify(message),
      })
    );
  }

  async sendResponseFromContentScriptToContentScript(message: Eip1193CustomEventResponse): Promise<void> {
    document.dispatchEvent(
      new CustomEvent('LayerzWalletExtension', {
        // Serialize message to JSON string to prevent Firefox security violations
        // when passing complex objects between content scripts
        detail: JSON.stringify(message),
      })
    );
  }

  sendGenericMessageToBackground<T extends keyof MessageTypeMap>(type: T, params: MessageTypeMap[T]['params']): Promise<MessageTypeMap[T]['response']> {
    return new Promise((resolve, reject) => {
      try {
        const message = { type, params };
        chrome.runtime.sendMessage(message, (response) => {
          if (response?.error) {
            reject(new Error(response.message));
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}

export const Messenger = new ExtensionMessenger();
