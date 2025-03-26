import assert from 'assert';
import { vi as jest, beforeEach, afterEach, test, expect } from 'vitest';

import { processRPC } from '../../modules/rpc-controller';
// import { BackgroundCaller } from '../../modules/background-caller';
import { Messenger } from '../../modules/messenger';
import { Eip1193CustomEventResponse } from '../../types/eip1193-custom-event';
// import { LayerzStorage } from '../../class/layerz-storage';
import * as networkGetters from '../../models/network-getters';
import { IStorage } from '../../types/IStorage';
import { CreateMnemonicResponse, EncryptMnemonicResponse, getBtcBalanceResponse, GetBtcSendDataResponse, IBackgroundCaller, SaveMnemonicResponse, SignPersonalMessageResponse, SignTypedDataResponse } from '../../types/IBackgroundCaller';
import { Networks } from '../../types/networks';

const messengerMock = () => ({
  Messenger: {
    sendResponseFromContentScriptToContentScript: () => {},
  },
});

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

jest.mock('../../../src/modules/messenger.ts', messengerMock);
jest.mock('../../../src/modules/background-caller.ts', backgroundCallerMock);


const _cache: Record<string, string> = {};
const storageMock: IStorage = {
  getItem: async (key: string) => {
    return Promise.resolve(_cache[key] || '');
  },
  setItem: async (key: string, value: string) => {
    _cache[key] = value;
    return Promise.resolve();
  }
};

const backgroundCallerMock2: IBackgroundCaller = {
  log: () => Promise.resolve(),
  getWhitelist: async () => Promise.resolve([]),
  hasAcceptedTermsOfService: async () => Promise.resolve(false),
  hasMnemonic: async () => Promise.resolve(false),
  hasEncryptedMnemonic: async () => Promise.resolve(false),
  openPopup: () => Promise.resolve(),
  getAddress: function (network: Networks, accountNumber: number): Promise<string> {
    return Promise.resolve('');
  },
  acceptTermsOfService: function (): Promise<void> {
    return Promise.resolve();
  },
  saveMnemonic: function (mnemonic: string): Promise<SaveMnemonicResponse> {
    throw new Error('Function not implemented.');
  },
  createMnemonic: function (): Promise<CreateMnemonicResponse> {
    throw new Error('Function not implemented.');
  },
  encryptMnemonic: function (password: string): Promise<EncryptMnemonicResponse> {
    throw new Error('Function not implemented.');
  },
  getBtcBalance: function (accountNumber: number): Promise<getBtcBalanceResponse> {
    throw new Error('Function not implemented.');
  },
  whitelistDapp: function (dapp: string): Promise<void> {
    throw new Error('Function not implemented.');
  },
  unwhitelistDapp: function (dapp: string): Promise<void> {
    throw new Error('Function not implemented.');
  },
  signPersonalMessage: function (message: string | Uint8Array, accountNumber: number, password: string): Promise<SignPersonalMessageResponse> {
    throw new Error('Function not implemented.');
  },
  signTypedData: function (message: any, accountNumber: number, password: string): Promise<SignTypedDataResponse> {
    throw new Error('Function not implemented.');
  },
  getBtcSendData: function (accountNumber: number): Promise<GetBtcSendDataResponse> {
    throw new Error('Function not implemented.');
  }
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
  const mockedMethod = jest.spyOn(Messenger, 'sendResponseFromContentScriptToContentScript').mockImplementation(async (message: Eip1193CustomEventResponse): Promise<void> => {
    assert.deepStrictEqual(message, { for: 'webpage', id: 12345, response: '0x0' });
  });

  const response = await processRPC(storageMock, backgroundCallerMock2, 'eth_chainId', {}, 12345, 'localhost');
  assert.deepStrictEqual(response, { success: true });
  expect(mockedMethod).toHaveBeenCalled();
});

test('RpcController can resolve calls that fallthrough to a real RPC (like eth_getBalance)', async () => {
  const mockedMethod = jest.spyOn(Messenger, 'sendResponseFromContentScriptToContentScript').mockImplementation(async (message: Eip1193CustomEventResponse): Promise<void> => {
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

  const response = await processRPC(storageMock, backgroundCallerMock2, 'eth_getBalance', ['0xF5e61719675B46848572249b65DC6d9D83E7180A', 'latest'], 12345, 'localhost');
  assert.deepStrictEqual(response, { success: true });
  expect(mockedMethod).toHaveBeenCalled();
  expect(mockedMethod2).toHaveBeenCalled();
});

test('RpcController can do calls that need to go to OPEN_POPUP that require user interaction (like personal_sign)', async () => {
  const mockedMethod = jest.spyOn(backgroundCallerMock2, 'openPopup').mockImplementation(async (method: string, params: any, id: number, from: string): Promise<void> => {
    assert.strictEqual(method, 'personal_sign');
    assert.deepStrictEqual(params, ['hello world', '0xF5e61719675B46848572249b65DC6d9D83E7180A']);
    assert.strictEqual(id, 12345);
    assert.strictEqual(from, 'localhost');
  });

  await processRPC(storageMock, backgroundCallerMock2, 'personal_sign', ['hello world', '0xF5e61719675B46848572249b65DC6d9D83E7180A'], 12345, 'localhost');
  expect(mockedMethod).toHaveBeenCalled();
});

test('wallet_switchEthereumChain opens popup', async () => {
  const mockedMethod = jest.spyOn(backgroundCallerMock2, 'openPopup').mockImplementation(async (method: string, params: any, id: number, from: string): Promise<void> => {
    assert.strictEqual(method, 'wallet_switchEthereumChain');
    assert.deepStrictEqual(params, [{ chainId: '0x1e' }]);
    assert.strictEqual(id, 12345);
    assert.strictEqual(from, 'localhost');
  });

  const response = await processRPC(storageMock, backgroundCallerMock2, 'wallet_switchEthereumChain', [{ chainId: '0x1e' }], 12345, 'localhost');
  console.log(response);
  expect(mockedMethod).toHaveBeenCalled();
});

test('wallet_switchEthereumChain when dapp is whitelisted is replying on the spot', async () => {
  /**
   * test plan:
   * 1. dapp is whitelisted (call mocked)
   * 2. `setItem` with new network is called (call is mocked)
   * 3. success message is sent back (call is mocked)
   * 4. `openPopup` is NOT called (call is mocked)
   *
   * making it all work by calling RPC controller for `wallet_switchEthereumChain`
   */
  const mockedMethod = jest.spyOn(backgroundCallerMock2, 'openPopup').mockImplementation(async (method: string, params: any, id: number, from: string): Promise<void> => {
    // wont be called at all
  });

  const mockedMethod2 = jest.spyOn(backgroundCallerMock2, 'getWhitelist').mockImplementation(async (): Promise<string[]> => {
    return ['localhost'];
  });

  const mockedMethod3 = jest.spyOn(Messenger, 'sendResponseFromContentScriptToContentScript').mockImplementation(async (message: Eip1193CustomEventResponse): Promise<void> => {
    assert.deepStrictEqual(message, { for: 'webpage', id: 12345, response: null });
  });

  const mockedMethod4 = jest.spyOn(storageMock, 'setItem').mockImplementation(async (key: string, value: string): Promise<void> => {
    assert.deepStrictEqual(key, 'STORAGE_SELECTED_NETWORK');
    assert.deepStrictEqual(value, 'rootstock');
  });

  const response = await processRPC(storageMock, backgroundCallerMock2, 'wallet_switchEthereumChain', [{ chainId: '0x1e' }], 12345, 'localhost');
  console.log(response);
  assert.deepStrictEqual(response, { success: true });
  expect(mockedMethod).toHaveBeenCalledTimes(0);
  expect(mockedMethod2).toHaveBeenCalledTimes(1);
  expect(mockedMethod3).toHaveBeenCalledTimes(1);
  expect(mockedMethod4).toHaveBeenCalledTimes(1);
});
