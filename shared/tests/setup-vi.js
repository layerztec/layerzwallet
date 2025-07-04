import nodeCrypto from 'crypto';

const mockStorage = {};
global.chrome = {
  storage: {
    local: {
      get: (key, result) => result({ [key]: mockStorage[key] }),
      set: (keyValue) => {
        for (const key of Object.keys(keyValue)) {
          mockStorage[key] = keyValue[key];
        }
      },
    },
  },
  runtime: {
    // @ts-ignore
    onMessage: {
      addListener: () => {},
    },
    sendMessage: () => {},
  },
  windows: {
    create: () => {},
    getCurrent: (arg1, callback) => {
      callback({ left: 0, top: 0 });
    },
  },
};

global.document = {
  addEventListener: () => {},
  dispatchEvent: () => {},
};

global.window = {
  location: {
    hostname: 'localhost',
  },
  crypto: nodeCrypto,
  fetch,
};

// Mock the messengerAdapter for tests
global.messengerAdapter = {
  sendResponseToActiveTabsFromPopupToContentScript: async () => {},
  sendEventCallbackFromPopupToContentScript: async () => {},
  documentDispatchEvent: () => {},
  sendResponseFromContentScriptToContentScript: async () => {},
  sendGenericMessageToBackground: async () => {},
};
