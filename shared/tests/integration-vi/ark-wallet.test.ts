import assert from 'assert';
import { test } from 'vitest';
import { ArkWallet } from '../../class/wallets/ark-wallet';
import { IStorage } from '../../types/IStorage';
import fs from 'fs';

const storageMock: IStorage = {
  async setItem(key: string, value: string) {
    console.log('setItem', key, '....');
    fs.writeFileSync('/tmp/ark-swap-storage' + key, value);
    // _cache[key] = value;
  },

  async getItem(key: string) {
    console.log('getItem', key);
    try {
      return fs.readFileSync('/tmp/ark-swap-storage' + key).toString('utf8');
    } catch {
      return '';
    }
    // return _cache[key];
  },
};

test.skip('ark mutinynet can check balance', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    context.skip();
    return;
  }

  const w = new ArkWallet();
  w.setSecret(process.env.TEST_MNEMONIC);
  await w.init(storageMock);

  const offchainBalance = await w.getOffchainBalance();

  assert.ok(offchainBalance >= 666);
});

test('ark mainnet can check balance', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    context.skip();
    return;
  }

  if (!(process.env.EXPO_PUBLIC_ARK_SERVER_URL && process.env.EXPO_PUBLIC_ARK_SERVER_PUBLIC_KEY && process.env.EXPO_PUBLIC_BOLTZ_API_URL)) {
    console.warn('skipped');
    context.skip();
    return;
  }

  const w = new ArkWallet();
  w.setSecret(process.env.TEST_MNEMONIC);
  w.setArkServerUrl(process.env.EXPO_PUBLIC_ARK_SERVER_URL);
  w.setArkServerPublicKey(process.env.EXPO_PUBLIC_ARK_SERVER_PUBLIC_KEY);
  w.setBoltzApiUrl(process.env.EXPO_PUBLIC_BOLTZ_API_URL);
  await w.init(storageMock);

  const offchainBalance = await w.getOffchainBalance();

  assert.ok(offchainBalance >= 6, `only have ${offchainBalance}`);
});

test('ark mainnet switch accounts', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    context.skip();
    return;
  }

  if (!(process.env.EXPO_PUBLIC_ARK_SERVER_URL && process.env.EXPO_PUBLIC_ARK_SERVER_PUBLIC_KEY && process.env.EXPO_PUBLIC_BOLTZ_API_URL)) {
    context.skip();
    return;
  }

  const w = new ArkWallet();
  w.setSecret(process.env.TEST_MNEMONIC);
  w.setArkServerUrl(process.env.EXPO_PUBLIC_ARK_SERVER_URL);
  w.setArkServerPublicKey(process.env.EXPO_PUBLIC_ARK_SERVER_PUBLIC_KEY);
  w.setBoltzApiUrl(process.env.EXPO_PUBLIC_BOLTZ_API_URL);
  await w.init(storageMock);

  //

  const receive0 = await w.getOffchainReceiveAddress();
  assert.ok(receive0);

  w.setAccountNumber(1);
  await w.init(storageMock);
  assert.ok(await w.getOffchainReceiveAddress());
  assert.ok(receive0 !== (await w.getOffchainReceiveAddress()));

  w.setAccountNumber(0);
  await w.init(storageMock);

  assert.ok(receive0 === (await w.getOffchainReceiveAddress()));
});

test.skip('ark mainnet can create lightning invoice', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    context.skip();
    return;
  }

  if (!(process.env.EXPO_PUBLIC_ARK_SERVER_URL && process.env.EXPO_PUBLIC_ARK_SERVER_PUBLIC_KEY && process.env.EXPO_PUBLIC_BOLTZ_API_URL)) {
    context.skip();
    return;
  }

  const w = new ArkWallet();
  w.setSecret(process.env.TEST_MNEMONIC);
  w.setArkServerUrl(process.env.EXPO_PUBLIC_ARK_SERVER_URL);
  w.setArkServerPublicKey(process.env.EXPO_PUBLIC_ARK_SERVER_PUBLIC_KEY);
  w.setBoltzApiUrl(process.env.EXPO_PUBLIC_BOLTZ_API_URL);

  await w.init(storageMock);
  await w.initLightningSwaps();

  const offchainBalance = await w.getOffchainBalance();
  console.log({ offchainBalance });

  // const pendingReverseSwaps = await w.getPendingReverseSwaps();
  // console.log('got', pendingReverseSwaps?.length ?? [], 'pending swaps');
  //
  // for (const swap of pendingReverseSwaps ?? []) {
  //   console.log('claiming...');
  //   const claimed = await w.claimVHTLC(swap);
  //   console.log('claimed=', claimed);
  // }

  // await w.createLightningInvoice(500, 'GSOM OLOLO');
});

test.skip('ark mainnet can pay lightning invoice', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    context.skip();
    return;
  }

  if (!(process.env.EXPO_PUBLIC_ARK_SERVER_URL && process.env.EXPO_PUBLIC_ARK_SERVER_PUBLIC_KEY && process.env.EXPO_PUBLIC_BOLTZ_API_URL)) {
    context.skip();
    return;
  }

  const w = new ArkWallet();
  w.setSecret(process.env.TEST_MNEMONIC);
  w.setArkServerUrl(process.env.EXPO_PUBLIC_ARK_SERVER_URL);
  w.setArkServerPublicKey(process.env.EXPO_PUBLIC_ARK_SERVER_PUBLIC_KEY);
  w.setBoltzApiUrl(process.env.EXPO_PUBLIC_BOLTZ_API_URL);
  await w.init(storageMock);

  const start = Date.now();
  await w.initLightningSwaps();
  const end = Date.now();
  console.log((end - start) / 1000, 'sec');

  const offchainBalance = await w.getOffchainBalance();
  console.log({ offchainBalance });

  const result = await w.payLightningInvoice(
    'lnbc19u1p5dd0qvpp5sc5nasn5us76usdaru40c0v8lztnddps9zh2dw0xmr378mag978sdqdveex7mfqv9exkcqzysxqyz5vqsp5rththnuptxdqyne9d4jt0lz037xhy9g8mrmuzy2w70dexryztljs9qxpqysgqw7t08t0csjrenxktlr8hmt6yyydhgczwz8wuyy74p39zx57fl3zkh2mza7updd8jfxpgcx5qdyacxt2znz2yq3rvgs7r9krfa8rf54gq8x8qpe',
    5
  );
  assert.ok(result);
});
