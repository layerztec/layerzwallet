import assert from 'assert';
import { vi as jest, test } from 'vitest';

import { DappPermissions } from '../../class/dapp-permissions';
import { IStorage } from '../../types/IStorage';

const messengerMock = () => ({
  Messenger: {
    sendResponseFromContentScriptToContentScript: () => {},
  },
});

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

test('DappPermissions', async () => {
  const dp = new DappPermissions('id', storageMock);

  const permissions = dp._permissionRequestToPermissions({
    eth_accounts: {
      requiredMethods: ['signTypedData_v3'],
    },
  });

  assert.ok(permissions[0]);
  assert.deepStrictEqual(permissions[0], {
    invoker: 'id',
    parentCapability: 'eth_accounts',
    caveats: {
      requiredMethods: ['signTypedData_v3'],
    },
  });

  // adding permission and checking a response

  const response = await dp.addPermissions({
    eth_accounts: {
      requiredMethods: ['signTypedData_v3'],
    },
  });

  assert.ok(response[0]);
  assert.strictEqual(response[0].parentCapability, 'eth_accounts');

  //

  const perms = await dp.getPermissions();

  assert.ok(perms[0]);
  assert.strictEqual(perms[0].invoker, 'id');
  assert.strictEqual(perms[0].parentCapability, 'eth_accounts');
  assert.deepStrictEqual(perms[0].caveats, {
    requiredMethods: ['signTypedData_v3'],
  });

  //

  await dp.addPermissions({
    aaa: {
      requiredMethods: ['bbb'],
    },
  });

  await dp.revokePermissions({ eth_accounts: {} });

  // added capability stays, deleted is absent:
  const perms2 = await dp.getPermissions();
  assert.strictEqual(perms2.length, 1);
  assert.strictEqual(perms2[0].invoker, 'id');
  assert.strictEqual(perms2[0].parentCapability, 'aaa');
});
