import assert from 'assert';
import { vi, afterEach, test, expect } from 'vitest';

import { BackgroundCaller } from '../../modules/background-caller';
import { MessageType, ProcessRPCRequest, SaveMnemonicRequest, SaveMnemonicResponse } from '@shared/types/IBackgroundCaller';
import { handleMessage } from '../../modules/background-message-controller';
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
      mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    } as SaveMnemonicRequest,
    {},
    (response: SaveMnemonicResponse) => {
      assert.strictEqual(response.success, true);
      handleMessageDone = true;
    }
  );

  while (!handleMessageDone) {
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
    STORAGE_KEY_LIQUIDTESTNET_MBK: '9c8e4f05c7711a98c838be228bcb84924d4570ca53f35fa1c793e58841d47023',
    STORAGE_KEY_LIQUIDTESTNET_XPUB0: 'xpub6Bm9M1SxZdzL3TxdNV8897FgtTLBgehR1wVNnMyJ5VLRK5n3tFqXxrCVnVQj4zooN4eFSkf6Sma84reWc5ZCXMxPbLXQs3BcaBdTd4YQa3B',
    STORAGE_KEY_LIQUIDTESTNET_XPUB1: 'xpub6Bm9M1SxZdzL7En61NC6MXPGg4F2RnFFA4QWtzQVUMvfdi2CTBrH53qysjDokoXVcWPaRCTTw3oiFucxidKEuZ5purNVFAdVXJ62JpitXgS',
    STORAGE_KEY_LIQUIDTESTNET_XPUB2: 'xpub6Bm9M1SxZdzL8LJiEdgyQSM5hsuovuVFucFXL3PUDmdbknLbiETfxBieFS23Zpkwate52JNFvvRHckYnseggzo1teeAgUqFf7YXUVDLAimS',
    STORAGE_KEY_LIQUIDTESTNET_XPUB3: 'xpub6Bm9M1SxZdzLB5XNMSQEFAHdQnvAt4phdAEwnLijnhYESNDGuoU9SzXuv3GFS8yFmm5YuEfwAsWwdBziJMZn6S5g5z4FfyCCV97KVN3KJXD',
    STORAGE_KEY_LIQUIDTESTNET_XPUB4: 'xpub6Bm9M1SxZdzLE3xBMJ334AnGD9J5fcasJc3HmWLmHjYeNCqkLEVGWrbYZABNcg3kXQm83nTaDh1igsD3yu2f2NHTdrAkuAtTMcMtkEtJNsE',
    STORAGE_KEY_LIQUIDTESTNET_XPUB5: 'xpub6Bm9M1SxZdzLHSaNd3baNXCamzfBC7ZBLHQuEtZi9FfY3tGaUniY3xxqu9mHQ87CSYxcdo3gts2HyybLUGYJyaNJy3ctq97WwBHpM2r6q4o',
    STORAGE_KEY_LIQUID_MBK: '9c8e4f05c7711a98c838be228bcb84924d4570ca53f35fa1c793e58841d47023',
    STORAGE_KEY_LIQUID_XPUB0: 'xpub6CRFzUgHFDaiDAQFNX7VeV9JNPDRabq6NYSpzVZ8zW8ANUCiDdenkb1gBoEZuXNZb3wPc1SVcDXgD2ww5UBtTb8s8ArAbTkoRQ8qn34KgcY',
    STORAGE_KEY_LIQUID_XPUB1: 'xpub6CRFzUgHFDaiGBmAUFj8xLie8XMZj82bsP1x6j2EviBpCh7d7F2jjcjZcQiXotD2RhuJ7eUvNpftTro96kfbHBHba5T4z4oQvcxmJGyX6M2',
    STORAGE_KEY_LIQUID_XPUB2: 'xpub6CRFzUgHFDaiGvYGty8tP8yV9okQw7dvSEiHyDANx8kuwUeAahBWnHNphWQCjDcu1Vz5EeC2mYu9q4LULesawHg6bJzUawm5QnEW6EK5Lfj',
    STORAGE_KEY_LIQUID_XPUB3: 'xpub6CRFzUgHFDaiM1LyduaS5DKxJCeM7Pj5UFHcPQ1quSsindB4c82fHzt5kEbAt9kBoN8eo3u8EDwNdfP6BRvQZtVYBJLhRePJ4EXsxnrK37d',
    STORAGE_KEY_LIQUID_XPUB4: 'xpub6CRFzUgHFDaiNRZH6FCxAFP6KyV3RJ8LUi2PAQ8YgNxR2KnYZwbEp8ckQaj9KtnviGSiGV6er9pjEg8f686f3CxvvSM7YrwonVKUXe4EJWz',
    STORAGE_KEY_LIQUID_XPUB5: 'xpub6CRFzUgHFDaiSR9Tzr5rvKZ7HSKVwW1dbH5ZDErimAwgNgFv8oJwMSGkt1dQpv2Sx4yM2vamf7pDh3vW8fDG9MB1TXHCkYGQsKKYsMyFu4w',
    STORAGE_KEY_MNEMONIC: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  });
  assert.strictEqual(response2, true);

  // checking that it was saved:

  await new Promise((resolve) => setTimeout(resolve, 100)); // sleep to allow callback to fire
  expect(setMockedMethod2).toHaveBeenCalledTimes(28);
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
      method: 'personal_sign',
      params: ['0x4578616d706c652060706572736f6e616c5f7369676e60206d657373616765', '0xF5e61719675B46848572249b65DC6d9D83E7180A', 'Example password'],
      id: 111,
      from: 'metamask.github.io',
    } as ProcessRPCRequest,
    // @ts-ignore not implementing full `Tab` type spec, need only `id`
    { tab: { id: 666 } },
    (response) => {
      callbackCalled = true;
    }
  );

  await new Promise((resolve) => setTimeout(resolve, 100)); // sleep to allow callback to fire
  assert.ok(!callbackCalled); // not called because popup returns result waaay later, via async messaging

  expect(openMockedMethod).toHaveBeenCalled();
});
