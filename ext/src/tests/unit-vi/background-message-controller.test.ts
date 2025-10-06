import assert from 'assert';
import { afterEach, expect, test, vi } from 'vitest';
import { MessageType } from '@shared/types/IBackgroundCaller';
import { BackgroundCaller } from '../../modules/background-caller';
import { handleMessage } from '../../modules/background-message-controller';
import { sanitizeAndValidateMnemonic } from '../../../../shared/modules/wallet-utils';

import CreateData = chrome.windows.CreateData;

vi.spyOn(console, 'log').mockImplementation(() => {});

afterEach(() => {
  vi.clearAllMocks();
});

test('BackgroundMessageController can handle messages SAVE_MNEMONIC', async () => {
  let staticCache: Record<string, any> = {};
  const getMockedMethod = vi.spyOn(chrome.storage.local, 'get').mockImplementation((key: any, callback: any) => {
    callback(staticCache);
  });
  const setMockedMethod2 = vi.spyOn(chrome.storage.local, 'set').mockImplementation((data: Record<any, any>) => {
    for (const key of Object.keys(data)) {
      staticCache[key] = data[key];
    }
  });

  // now, saving mnemonics

  let handleMessageDone = false;
  const response2 = handleMessage(
    {
      type: MessageType.SAVE_MNEMONIC,
      params: ['abandon abandon abandon abandon abandon abandon abandon abandon\nabandon abandon abandon ABOUT'],
    },
    {},
    (response) => {
      handleMessageDone = true;
      assert.strictEqual(response, true);
    }
  );

  while (!handleMessageDone) {
    console.info('checking', handleMessageDone);
    await new Promise((resolve) => setTimeout(resolve, 500)); // sleep to allow callback to fire
  }

  assert.deepStrictEqual(staticCache, {
    STORAGE_KEY_BTC_XPUB0: 'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs',
    STORAGE_KEY_BTC_XPUB1: 'zpub6rFR7y4Q2AijF6Gk1bofHLs1d66hKFamhXWdWBup1Em25wfabZqkDqvaieV63fDQFaYmaatCG7jVNUpUiM2hAMo6SAVHcrUpSnHDpNzucB7',
    STORAGE_KEY_BTC_XPUB2: 'zpub6rFR7y4Q2AijHxf5H8YD9SZ1S1hrLi3PmbR9iJeVVZSJmK8R86EPCwBhyTaycoeXEVqLigViktQUy2tt3yLnvcZ7BcXz9QxHrLjaTeJn3xL',
    STORAGE_KEY_BTC_XPUB3: 'zpub6rFR7y4Q2AijKtJ66XKz29oDCtvXLTHgJ71fjNCS5kWGi97AcTfHkPPxL9GNPzR2TaqfcJx2WrcfQEHCjx7LcJz3jwwvQm4D1fcW7aiGxfT',
    STORAGE_KEY_BTC_XPUB4: 'zpub6rFR7y4Q2AijM8GBWicX3FmPEK8juiGC1TueN7qQzGFLTKQbFrQsgBwrco3DgKidS4DwYUC12UULUux5XvPtgzmy1HoDpDhGABnnEyBQzsL',
    STORAGE_KEY_BTC_XPUB5: 'zpub6rFR7y4Q2AijQjSx77gqZXw7AaQbpFuyD1YAZVjGDyWv4cPPMDQL5S2VbzHXp6wC5jLgawPtSMg5cRoC6UncmteTRF6PxeUemGdRm9fxuQM',
    STORAGE_KEY_EVM_XPUB: 'xpub6EF8jXqFeFEW5bwMU7RpQtHkzE4KJxcqJtvkCjJumzW8CPpacXkb92ek4WzLQXjL93HycJwTPUAcuNxCqFPKKU5m5Z2Vq4nCyh5CyPeBFFr',

    STORAGE_KEY_MNEMONIC: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  });
  assert.strictEqual(response2, true);

  // checking that it was saved:

  await new Promise((resolve) => setTimeout(resolve, 100)); // sleep to allow callback to fire
  expect(setMockedMethod2).toHaveBeenCalledTimes(8);
  expect(getMockedMethod).toHaveBeenCalledTimes(0);

  // confirm mnemonic not encrypted though present
  const encrypted = await BackgroundCaller.hasEncryptedMnemonic();
  assert.strictEqual(encrypted, false);

  // "encrypt" it
  staticCache.STORAGE_KEY_MNEMONIC = 'encrypted://';

  const encrypted2 = await BackgroundCaller.hasEncryptedMnemonic();
  assert.strictEqual(encrypted2, true);

  expect(getMockedMethod).toHaveBeenCalledTimes(2); // `hasEncryptedMnemonic()` had to read storage, thus triggering `get`mock
});

test('BackgroundMessageController can handle message OPEN_POPUP', async () => {
  const openMockedMethod = vi.spyOn(chrome.windows, 'create').mockImplementation((createData: CreateData) => {
    assert.deepStrictEqual(createData, {
      url: 'popup.html#/action?method=personal_sign&id=111&params=%5B%220x4578616d706c652060706572736f6e616c5f7369676e60206d657373616765%22%2C%220xF5e61719675B46848572249b65DC6d9D83E7180A%22%2C%22Example%20password%22%5D&from=metamask.github.io',
      type: 'popup',
      focused: true,
      width: 600,
      height: 800,
      left: 200,
      top: 100,
    });
  });

  let callbackCalled = false;

  handleMessage(
    {
      type: MessageType.OPEN_POPUP,
      params: [
        // method
        'personal_sign',
        // params
        ['0x4578616d706c652060706572736f6e616c5f7369676e60206d657373616765', '0xF5e61719675B46848572249b65DC6d9D83E7180A', 'Example password'],
        // id
        111,
        // from
        'metamask.github.io',
      ],
    },
    // @ts-ignore not implementing full `Tab` type spec, need only `id`
    { tab: { id: 666 } },
    () => {
      callbackCalled = true;
    }
  );

  await new Promise((resolve) => setTimeout(resolve, 100)); // sleep to allow callback to fire
  assert.ok(!callbackCalled); // not called because popup returns result waaay later, via async messaging

  expect(openMockedMethod).toHaveBeenCalled();
});

test('sanitizeAndValidateMnemonic should handle complex whitespace scenarios', () => {
  const mnemonic = '\n\n  abandon\t abandon   abandon\r\n abandon abandon  abandon\t\t abandon abandon abandon abandon   abandon ABOUT  \n\n';
  const result = sanitizeAndValidateMnemonic(mnemonic);
  assert.strictEqual(result, 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
});

test('sanitizeAndValidateMnemonic should throw error for mnemonic with less than 12 words', () => {
  const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon';
  assert.throws(() => {
    sanitizeAndValidateMnemonic(mnemonic);
  }, /Invalid mnemonic length/);
});

test('sanitizeAndValidateMnemonic should throw error for invalid BIP39 mnemonic', () => {
  // Valid length (12 words) but invalid words and/or checksum
  const mnemonic = 'invalid word word word word word word word word word word word';
  assert.throws(() => {
    sanitizeAndValidateMnemonic(mnemonic);
  }, /Invalid mnemonic/);
});
