import assert from 'assert';
import { beforeEach, test } from 'vitest';
import { ArkWallet } from '../../class/wallets/ark-wallet';
import { IStorage } from '../../types/IStorage';

// In-memory storage — do not persist under /tmp; stale VTXO caches survive CI/local
// reruns and block incremental sync after Arkade server signer rotation.
const storageCache: Record<string, string> = {};
const storageMock: IStorage = {
  async setItem(key: string, value: string) {
    storageCache[key] = value;
  },

  async getItem(key: string) {
    return storageCache[key] ?? '';
  },
};

beforeEach(() => {
  for (const key of Object.keys(storageCache)) {
    delete storageCache[key];
  }
});

test.skip('ark mutinynet can check balance', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    console.warn('TEST_MNEMONIC not set, skipping');
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
    console.warn('TEST_MNEMONIC not set, skipping');
    context.skip();
    return;
  }

  const w = new ArkWallet();
  w.setSecret(process.env.TEST_MNEMONIC);
  w.setArkServerUrl('https://arkade.computer');
  w.setBoltzApiUrl('https://api.ark.boltz.exchange');
  await w.init(storageMock);

  const offchainBalance = await w.getOffchainBalance();

  assert.ok(offchainBalance >= 6, `only have ${offchainBalance}`);
});

// muted because there is no actual data in mock storage after our storage migration
test.skip('ark mainnet can check if our invoice is paid', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    console.warn('TEST_MNEMONIC not set, skipping');
    context.skip();
    return;
  }

  const w = new ArkWallet();
  w.setSecret(process.env.TEST_MNEMONIC);
  w.setArkServerUrl('https://arkade.computer');
  w.setBoltzApiUrl('https://api.ark.boltz.exchange');
  await w.init(storageMock);

  // TODO: put data in storage

  await w.initLightningSwaps();

  const isPaid = await w.isInvoicePaid(
    'lnbc5u1p5ddkvzpp5edvmfczyxgd0j2t4xkg7raye4l5c0cfknya3jtmpsuy0hvvzm8dsdqsgaf57nfqfaxy7nz0cqz95xqyp2xqsp5farygz7rdact335vzuvrfywz9rpnqp7pnlugf2dj3whxy70degeq9qxpqysgq6gpcaggx43hpyr7gr8wlh52q6qphntnpyuk9xx5c9mrhmlgh48c4dcyrn2ufmr6peux6ncr2ky2ftas2yav8l8e5zzrpgjj4zpg8fqqqqhpvp8'
  );

  assert.ok(isPaid);
});

test('ark mainnet switch accounts', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    console.warn('TEST_MNEMONIC not set, skipping');
    context.skip();
    return;
  }

  const w = new ArkWallet();
  w.setSecret(process.env.TEST_MNEMONIC);
  w.setArkServerUrl('https://arkade.computer');
  w.setBoltzApiUrl('https://api.ark.boltz.exchange');
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
    console.warn('TEST_MNEMONIC not set, skipping');
    context.skip();
    return;
  }

  const w = new ArkWallet();
  w.setSecret(process.env.TEST_MNEMONIC);
  w.setArkServerUrl('https://arkade.computer');
  w.setBoltzApiUrl('https://api.ark.boltz.exchange');

  await w.init(storageMock);
  await w.initLightningSwaps();

  const offchainBalance = await w.getOffchainBalance();
  console.log({ offchainBalance });

  await w.createLightningInvoice(500, 'GSOM OLOLO');
});

test.skip('ark mainnet can pay lightning invoice', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    console.warn('TEST_MNEMONIC not set, skipping');
    context.skip();
    return;
  }

  const w = new ArkWallet();
  w.setSecret(process.env.TEST_MNEMONIC);
  w.setArkServerUrl('https://arkade.computer');
  w.setBoltzApiUrl('https://api.ark.boltz.exchange');
  await w.init(storageMock);

  const start = Date.now();
  await w.initLightningSwaps();
  const end = Date.now();
  console.log((end - start) / 1000, 'sec');

  const offchainBalance = await w.getOffchainBalance();
  console.log({ offchainBalance });

  const result = await w.payLightningInvoice(
    'lnbc19u1p5dd0qvpp5sc5nasn5us76usdaru40c0v8lztnddps9zh2dw0xmr378mag978sdqdveex7mfqv9exkcqzysxqyz5vqsp5rththnuptxdqyne9d4jt0lz037xhy9g8mrmuzy2w70dexryztljs9qxpqysgqw7t08t0csjrenxktlr8hmt6yyydhgczwz8wuyy74p39zx57fl3zkh2mza7updd8jfxpgcx5qdyacxt2znz2yq3rvgs7r9krfa8rf54gq8x8qpe'
  );
  assert.ok(result);
});
