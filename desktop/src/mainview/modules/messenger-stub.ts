import { IMessenger } from "@shared/modules/messenger";

export const Messenger: IMessenger = {
  async sendResponseToActiveTabsFromPopupToContentScript() {},
  async sendEventCallbackFromPopupToContentScript() {},
  documentDispatchEvent() {},
  async sendResponseFromContentScriptToContentScript() {},
  async sendGenericMessageToBackground() {
    throw new Error("Desktop wallet does not use background messaging");
  },
};
