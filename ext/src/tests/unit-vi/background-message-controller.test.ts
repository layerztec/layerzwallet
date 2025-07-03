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
    STORAGE_KEY_ARK_ADDRESS0: 'tark1lfeudey8dlajmlykr4mrej56h3eafwywlju0telljtw9t6d2257sa5gmmhg8e654m2rvjtgcj2pd8n078n5vf5706qknqamhwckal6g2euerj',
    STORAGE_KEY_ARK_ADDRESS1: 'tark1lfeudey8dlajmlykr4mrej56h3eafwywlju0telljtw9t6d22576z0zufgkpqprdp6pyr8r33wd9t2rtkzr7sum0xqlu7u59k6nz4jsz3avar',
    STORAGE_KEY_ARK_ADDRESS2: 'tark1lfeudey8dlajmlykr4mrej56h3eafwywlju0telljtw9t6d2257ssrlm57sa9qhe9wgsjhldg88fkaec5mmrm95nazrtuvm3w2pcsaqx9nt8p',
    STORAGE_KEY_ARK_ADDRESS3: 'tark1lfeudey8dlajmlykr4mrej56h3eafwywlju0telljtw9t6d2257uh4f6hp9rkqx8x7krzzqwnt9rddck83pk2gexpud9kdee5aefgfqezryr8',
    STORAGE_KEY_ARK_ADDRESS4: 'tark1lfeudey8dlajmlykr4mrej56h3eafwywlju0telljtw9t6d22577694x3wjwldv07x36aaxysnlgc2te4en0vp0cnh3vd8c2st67e4sw7rdl8',
    STORAGE_KEY_ARK_ADDRESS5: 'tark1lfeudey8dlajmlykr4mrej56h3eafwywlju0telljtw9t6d2257ux2fvshjrr4u403378qusn8nkc9dmakf6p2m4wxlhhr8ga92kpyc9798n9',
    STORAGE_KEY_BTC_XPUB0: 'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs',
    STORAGE_KEY_BTC_XPUB1: 'zpub6rFR7y4Q2AijF6Gk1bofHLs1d66hKFamhXWdWBup1Em25wfabZqkDqvaieV63fDQFaYmaatCG7jVNUpUiM2hAMo6SAVHcrUpSnHDpNzucB7',
    STORAGE_KEY_BTC_XPUB2: 'zpub6rFR7y4Q2AijHxf5H8YD9SZ1S1hrLi3PmbR9iJeVVZSJmK8R86EPCwBhyTaycoeXEVqLigViktQUy2tt3yLnvcZ7BcXz9QxHrLjaTeJn3xL',
    STORAGE_KEY_BTC_XPUB3: 'zpub6rFR7y4Q2AijKtJ66XKz29oDCtvXLTHgJ71fjNCS5kWGi97AcTfHkPPxL9GNPzR2TaqfcJx2WrcfQEHCjx7LcJz3jwwvQm4D1fcW7aiGxfT',
    STORAGE_KEY_BTC_XPUB4: 'zpub6rFR7y4Q2AijM8GBWicX3FmPEK8juiGC1TueN7qQzGFLTKQbFrQsgBwrco3DgKidS4DwYUC12UULUux5XvPtgzmy1HoDpDhGABnnEyBQzsL',
    STORAGE_KEY_BTC_XPUB5: 'zpub6rFR7y4Q2AijQjSx77gqZXw7AaQbpFuyD1YAZVjGDyWv4cPPMDQL5S2VbzHXp6wC5jLgawPtSMg5cRoC6UncmteTRF6PxeUemGdRm9fxuQM',
    STORAGE_KEY_EVM_XPUB: 'xpub6EF8jXqFeFEW5bwMU7RpQtHkzE4KJxcqJtvkCjJumzW8CPpacXkb92ek4WzLQXjL93HycJwTPUAcuNxCqFPKKU5m5Z2Vq4nCyh5CyPeBFFr',

    STORAGE_KEY_MNEMONIC: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    STORAGE_KEY_SUB_MNEMONIC0: 'prosper short ramp prepare exchange stove life snack client enough purpose fold',
    STORAGE_KEY_SUB_MNEMONIC1: 'sing slogan bar group gauge sphere rescue fossil loyal vital model desert',
    STORAGE_KEY_SUB_MNEMONIC2: 'comfort onion auto dizzy upgrade mutual banner announce section poet point pudding',
    STORAGE_KEY_SUB_MNEMONIC3: 'tuna mention protect shrimp mushroom access cat cattle license bind equip trial',
    STORAGE_KEY_SUB_MNEMONIC4: 'soon catalog dragon burger veteran fish pair grass prefer shallow power smart',
    STORAGE_KEY_SUB_MNEMONIC5: 'ceiling fringe unknown start royal quarter segment wet glide fiscal behind scheme',
  });
  assert.strictEqual(response2, true);

  // checking that it was saved:

  await new Promise((resolve) => setTimeout(resolve, 100)); // sleep to allow callback to fire
  expect(setMockedMethod2).toHaveBeenCalledTimes(20);
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
