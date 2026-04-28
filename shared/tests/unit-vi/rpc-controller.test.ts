import assert from 'assert';
import { afterEach, beforeEach, expect, vi as jest, test } from 'vitest';

import * as networkGetters from '../../models/network-getters';
import { IMessenger } from '../../modules/messenger';
import { processRPC } from '../../modules/rpc-controller';
import { Eip1193CustomEventResponse } from '../../types/eip1193-custom-event';
import { IBackgroundCaller } from '../../types/IBackgroundCaller';
import { IStorage } from '../../types/IStorage';

const messengerMock: IMessenger = {
  sendResponseToActiveTabsFromPopupToContentScript: jest.fn(),
  sendEventCallbackFromPopupToContentScript: jest.fn(),
  documentDispatchEvent: jest.fn(),
  sendResponseFromContentScriptToContentScript: jest.fn(),
  sendGenericMessageToBackground: jest.fn(),
};

const backgroundCallerMock = () => ({
  BackgroundCaller: {
    log: () => true,
    getWhitelist: async () => Promise.resolve([]),
    hasAcceptedTermsOfService: async () => Promise.resolve(false),
    hasMnemonic: async () => Promise.resolve(false),
    hasEncryptedMnemonic: async () => Promise.resolve(false),
    openPopup: () => {},
  },
});

jest.mock('../../../src/modules/messenger.ts', () => ({ Messenger: messengerMock }));
jest.mock('../../../src/modules/background-caller.ts', backgroundCallerMock);

const _cache: Record<string, string> = {};
const storageMock: IStorage = {
  getItem: async (key: string) => {
    return Promise.resolve(_cache[key] || '');
  },
  setItem: async (key: string, value: string) => {
    _cache[key] = value;
    return Promise.resolve();
  },
};

const backgroundCallerMock2: IBackgroundCaller = {
  setMasterSeed: () => Promise.resolve(),
  getMasterSeed: () => Promise.resolve(''),
  lazyInitWallet: () => Promise.reject(),
  lazyInitWalletReady: () => false,
  log: () => Promise.resolve(),
  getWhitelist: async () => Promise.resolve([]),
  hasAcceptedTermsOfService: async () => Promise.resolve(false),
  hasMnemonic: async () => Promise.resolve(false),
  hasEncryptedMnemonic: async () => Promise.resolve(false),
  openPopup: () => Promise.resolve(),
  getAddress() {
    return Promise.resolve('');
  },
  acceptTermsOfService: function (): Promise<void> {
    return Promise.resolve();
  },
  saveMnemonic() {
    throw new Error('Function not implemented.');
  },
  createMnemonic() {
    throw new Error('Function not implemented.');
  },
  encryptMnemonic() {
    throw new Error('Function not implemented.');
  },
  getBtcBalance() {
    throw new Error('Function not implemented.');
  },
  whitelistDapp() {
    throw new Error('Function not implemented.');
  },
  unwhitelistDapp() {
    throw new Error('Function not implemented.');
  },
  getBtcSendData() {
    throw new Error('Function not implemented.');
  },
  getCommonTransactions() {
    throw new Error('Function not implemented.');
  },
  clear() {
    throw new Error('Function not implemented.');
  },
  hasSeedVerified() {
    return Promise.resolve(false);
  },
  setSeedVerified() {
    return Promise.resolve();
  },
  getMnemonicForVerification() {
    return Promise.resolve(null);
  },
};

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {
    // nop
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

test('RpcController can resolve simple calls (like eth_chainId) on the spot', async () => {
  const mockedMethod = jest.spyOn(messengerMock, 'sendResponseFromContentScriptToContentScript').mockImplementation(async (message: Eip1193CustomEventResponse): Promise<void> => {
    assert.deepStrictEqual(message, { for: 'webpage', id: 12345, response: '0x0' });
  });

  const response = await processRPC(storageMock, backgroundCallerMock2, 'eth_chainId', {}, 12345, 'localhost', messengerMock);
  assert.deepStrictEqual(response, { success: true });
  expect(mockedMethod).toHaveBeenCalled();
});

test('RpcController can resolve calls that fallthrough to a real RPC (like eth_getBalance)', async () => {
  const mockedMethod = jest.spyOn(messengerMock, 'sendResponseFromContentScriptToContentScript').mockImplementation(async (message: Eip1193CustomEventResponse): Promise<void> => {
    assert.deepStrictEqual(message, { for: 'webpage', id: 12345, response: '0xdeadbabe' /* balance of the address */ });
  });

  // @ts-ignore dont need to implement the method completely, implementing only `send()`, so its not type-complete
  const mockedMethod2 = jest.spyOn(networkGetters, 'getRpcProvider').mockImplementation(() => {
    // mocking send method to NOT do an actual network call
    return {
      send: async (method: string, params: string[]) => {
        assert.strictEqual(method, 'eth_getBalance');
        assert.deepStrictEqual(params, ['0xF5e61719675B46848572249b65DC6d9D83E7180A', 'latest']);
        return '0xdeadbabe';
      },
    };
  });

  const response = await processRPC(storageMock, backgroundCallerMock2, 'eth_getBalance', ['0xF5e61719675B46848572249b65DC6d9D83E7180A', 'latest'], 12345, 'localhost', messengerMock);
  assert.deepStrictEqual(response, { success: true });
  expect(mockedMethod).toHaveBeenCalled();
  expect(mockedMethod2).toHaveBeenCalled();
});

test('RpcController short-circuits eth_maxPriorityFeePerGas with eth_gasPrice on Rootstock', async () => {
  await storageMock.setItem('STORAGE_SELECTED_NETWORK', 'rootstock');

  const mockedMethod = jest.spyOn(messengerMock, 'sendResponseFromContentScriptToContentScript').mockImplementation(async (message: Eip1193CustomEventResponse): Promise<void> => {
    assert.deepStrictEqual(message, { for: 'webpage', id: 12345, response: '0x3b9aca00' });
  });

  // @ts-ignore partial mock, only `send()` is needed
  const mockedMethod2 = jest.spyOn(networkGetters, 'getRpcProvider').mockImplementation(() => {
    return {
      send: async (method: string) => {
        assert.strictEqual(method, 'eth_gasPrice'); // we should NOT forward eth_maxPriorityFeePerGas to Rootstock
        return '0x3b9aca00';
      },
    };
  });

  const response = await processRPC(storageMock, backgroundCallerMock2, 'eth_maxPriorityFeePerGas', [], 12345, 'localhost', messengerMock);
  assert.deepStrictEqual(response, { success: true });
  expect(mockedMethod).toHaveBeenCalled();
  expect(mockedMethod2).toHaveBeenCalled();

  await storageMock.setItem('STORAGE_SELECTED_NETWORK', '');
});

test('RpcController can do calls that need to go to OPEN_POPUP that require user interaction (like personal_sign)', async () => {
  const mockedMethod = jest.spyOn(backgroundCallerMock2, 'openPopup').mockImplementation(async (method: string, params: any, id: number, from: string): Promise<void> => {
    assert.strictEqual(method, 'personal_sign');
    assert.deepStrictEqual(params, ['hello world', '0xF5e61719675B46848572249b65DC6d9D83E7180A']);
    assert.strictEqual(id, 12345);
    assert.strictEqual(from, 'localhost');
  });

  await processRPC(storageMock, backgroundCallerMock2, 'personal_sign', ['hello world', '0xF5e61719675B46848572249b65DC6d9D83E7180A'], 12345, 'localhost', messengerMock);
  expect(mockedMethod).toHaveBeenCalled();
});

test('wallet_switchEthereumChain rejects unsupported chainId with EIP-3326 code 4902', async () => {
  const mockedOpenPopup = jest.spyOn(backgroundCallerMock2, 'openPopup').mockImplementation(async () => {
    // must NOT be called
  });

  const mockedSendResponse = jest.spyOn(messengerMock, 'sendResponseFromContentScriptToContentScript').mockImplementation(async (message: Eip1193CustomEventResponse): Promise<void> => {
    assert.strictEqual(message.for, 'webpage');
    assert.strictEqual(message.id, 12345);
    assert.strictEqual(message.error?.code, 4902);
  });

  const response = await processRPC(storageMock, backgroundCallerMock2, 'wallet_switchEthereumChain', [{ chainId: '0xa4b1' /* Arbitrum - unsupported */ }], 12345, 'localhost', messengerMock);
  assert.deepStrictEqual(response, { success: true });
  expect(mockedSendResponse).toHaveBeenCalledTimes(1);
  expect(mockedOpenPopup).toHaveBeenCalledTimes(0);
});

test('wallet_switchEthereumChain auto-switches on the spot for supported chains (no popup, no whitelist check)', async () => {
  /**
   * test plan:
   * 1. `setItem` with new network is called (call is mocked)
   * 2. success message is sent back (call is mocked)
   * 3. `openPopup` is NOT called (call is mocked)
   * 4. works regardless of whitelist status (dapp is NOT whitelisted)
   */
  const mockedOpenPopup = jest.spyOn(backgroundCallerMock2, 'openPopup').mockImplementation(async () => {
    // must NOT be called
  });

  const mockedSendResponse = jest.spyOn(messengerMock, 'sendResponseFromContentScriptToContentScript').mockImplementation(async (message: Eip1193CustomEventResponse): Promise<void> => {
    assert.deepStrictEqual(message, { for: 'webpage', id: 12345, response: null });
  });

  const mockedSetItem = jest.spyOn(storageMock, 'setItem').mockImplementation(async (key: string, value: string): Promise<void> => {
    assert.deepStrictEqual(key, 'STORAGE_SELECTED_NETWORK');
    assert.deepStrictEqual(value, 'rootstock');
  });

  const response = await processRPC(storageMock, backgroundCallerMock2, 'wallet_switchEthereumChain', [{ chainId: '0x1e' }], 12345, 'localhost', messengerMock);
  assert.deepStrictEqual(response, { success: true });
  expect(mockedOpenPopup).toHaveBeenCalledTimes(0);
  expect(mockedSendResponse).toHaveBeenCalledTimes(1);
  expect(mockedSetItem).toHaveBeenCalledTimes(1);
});
