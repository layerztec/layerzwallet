import assert from 'assert';
import { test } from 'vitest';
import { ArkWallet } from '../../class/wallets/ark-wallet';
import { IStorage } from '../../types/IStorage';
import fs from 'fs';

// const _cache: Record<string, string> = {};
const storageMock: IStorage = {
  async setItem(key: string, value: string) {
    console.log('setItem', key, value);
    fs.writeFileSync('/tmp/ark-swap-storage' + key, value);
    // _cache[key] = value;
  },

  async getItem(key: string) {
    console.log('getItem', key);
    return fs.readFileSync('/tmp/ark-swap-storage' + key).toString('utf8');
    // return _cache[key];
  },
};

test('ark', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    context.skip();
    return;
  }

  const w = new ArkWallet();
  w.setSecret(process.env.TEST_MNEMONIC);
  await w.init();

  const offchainBalance = await w.getOffchainBalance();

  assert.ok(offchainBalance >= 666);
});

test.skip('ark can create lightning invoice', async (context) => {
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

  await w.init();

  const start = Date.now();
  await w.initLightningSwaps(storageMock);
  const end = Date.now();
  console.log((end - start) / 1000, 'sec');

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

  // await w.createLightningInvoice(2000, 'GSOM OLOLO');
});

test.skip('ark can pay lightning invoice', async (context) => {
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
  await w.init();

  const start = Date.now();
  await w.initLightningSwaps(storageMock);
  const end = Date.now();
  console.log((end - start) / 1000, 'sec');

  const offchainBalance = await w.getOffchainBalance();
  console.log({ offchainBalance });

  const result = await w.payLightningInvoice(
    'lnbc4u1p5tny79pp5u2ruqyfjk7q9p6m56w7mdk74lpt48fzt9gcz0dlvgtaty6us4k3sdql6z6dpvxsktgtp59eyrgtt59l6xpdpvqcqzysxqyz5vqsp5y2n3r7eylde6wmx4p029kcky62mtjh7pa07huph8jxjr6matfuas9qxpqysgqdg5gwdegq3w6jnyj8tymd4gqhpnjy4qdszlj7s0hatarsa42nclz7uh0x2c6aw2cf2ehpxv5j9f6th4n99zgd76a6kvunn9fzsk0ewqpdy68kz',
    5
  );
  assert.ok(result);
});
