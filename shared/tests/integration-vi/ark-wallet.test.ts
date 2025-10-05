import assert from 'assert';
import { test } from 'vitest';
import { ArkWallet } from '../../class/wallets/ark-wallet';
import { IStorage } from '../../types/IStorage';
import fs from 'fs';

const storageMock: IStorage = {
  async setItem(key: string, value: string) {
    fs.writeFileSync('/tmp/ark-swap-storage' + key, value);
  },

  async getItem(key: string) {
    try {
      return fs.readFileSync('/tmp/ark-swap-storage' + key).toString('utf8');
    } catch {
      return '';
    }
  },
};

test.skip('arkade mutinynet can check balance', async (context) => {
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

test('arkade mainnet can check balance', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    console.warn('TEST_MNEMONIC not set, skipping');
    context.skip();
    return;
  }

  if (!(process.env.EXPO_PUBLIC_ARK_SERVER_URL && process.env.EXPO_PUBLIC_ARK_SERVER_PUBLIC_KEY && process.env.EXPO_PUBLIC_BOLTZ_API_URL)) {
    console.warn('env not set, skipping');
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

test('arkade mainnet can check if our invoice is paid', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    console.warn('TEST_MNEMONIC not set, skipping');
    context.skip();
    return;
  }

  if (!(process.env.EXPO_PUBLIC_ARK_SERVER_URL && process.env.EXPO_PUBLIC_ARK_SERVER_PUBLIC_KEY && process.env.EXPO_PUBLIC_BOLTZ_API_URL)) {
    console.warn('env not set, skipping');
    context.skip();
    return;
  }

  const w = new ArkWallet();
  w.setSecret(process.env.TEST_MNEMONIC);
  w.setArkServerUrl(process.env.EXPO_PUBLIC_ARK_SERVER_URL);
  w.setArkServerPublicKey(process.env.EXPO_PUBLIC_ARK_SERVER_PUBLIC_KEY);
  w.setBoltzApiUrl(process.env.EXPO_PUBLIC_BOLTZ_API_URL);
  await w.init(storageMock);

  // Read existing reverse swaps from storage, parse, and append mocked record if not present
  const reverseSwapsKey = 'collection:reverseSwaps';
  const newRecord = {
    type: 'reverse',
    createdAt: 1758910851,
    preimage: 'fb270e04b5859f4a59caf09059d07f4517efe72b2cf7a4f6a0b5bd411adea4a7',
    request: {
      invoiceAmount: 500,
      claimPublicKey: '03ea1002f3113fd307bb27aeaf9b0559ff1ec6b042fded42eaaabf78019d67935d',
      preimageHash: 'cb59b4e044321af929753591e1f499afe987e136993b192f618708fbb182d9db',
      description: 'GSOM OLOLO',
    },
    response: {
      id: 'xzZmJ5584vxV',
      lockupAddress: 'ark1qqh3n2f2pmt6gn7m4m0g7tj33942cq4y5qcjfhdxp7rsqyp4gvhe482px5azq5stmx8a3vl6qf2h0uq6400an5gwf32zxezkjxv8n6m9m66hx2',
      refundPublicKey: '026d9a6a5f384333add3bbe1dd6e6f6e3e6b633d7395c19dcc2ec64ef3748710cd',
      timeoutBlockHeights: {
        refund: 916640,
        unilateralClaim: 16,
        unilateralRefund: 144,
        unilateralRefundWithoutReceiver: 144,
      },
      invoice:
        'lnbc5u1p5ddkvzpp5edvmfczyxgd0j2t4xkg7raye4l5c0cfknya3jtmpsuy0hvvzm8dsdqsgaf57nfqfaxy7nz0cqz95xqyp2xqsp5farygz7rdact335vzuvrfywz9rpnqp7pnlugf2dj3whxy70degeq9qxpqysgq6gpcaggx43hpyr7gr8wlh52q6qphntnpyuk9xx5c9mrhmlgh48c4dcyrn2ufmr6peux6ncr2ky2ftas2yav8l8e5zzrpgjj4zpg8fqqqqhpvp8',
      onchainAmount: 499,
    },
    status: 'invoice.settled',
  };

  let reverseSwapsRaw = await storageMock.getItem(reverseSwapsKey);
  let reverseSwapsArr = [];
  if (reverseSwapsRaw) {
    try {
      reverseSwapsArr = JSON.parse(reverseSwapsRaw);
      if (!Array.isArray(reverseSwapsArr)) {
        reverseSwapsArr = [];
      }
    } catch (e) {
      reverseSwapsArr = [];
    }
  }
  const exists = reverseSwapsArr.some((r) => r.preimage === newRecord.preimage);
  if (!exists) {
    reverseSwapsArr.push(newRecord);
    await storageMock.setItem(reverseSwapsKey, JSON.stringify(reverseSwapsArr));
  }

  await w.initLightningSwaps();

  const isPaid = await w.isInvoicePaid(
    'lnbc5u1p5ddkvzpp5edvmfczyxgd0j2t4xkg7raye4l5c0cfknya3jtmpsuy0hvvzm8dsdqsgaf57nfqfaxy7nz0cqz95xqyp2xqsp5farygz7rdact335vzuvrfywz9rpnqp7pnlugf2dj3whxy70degeq9qxpqysgq6gpcaggx43hpyr7gr8wlh52q6qphntnpyuk9xx5c9mrhmlgh48c4dcyrn2ufmr6peux6ncr2ky2ftas2yav8l8e5zzrpgjj4zpg8fqqqqhpvp8'
  );

  assert.ok(isPaid);
});

test('arkade mainnet switch accounts', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    console.warn('TEST_MNEMONIC not set, skipping');
    context.skip();
    return;
  }

  if (!(process.env.EXPO_PUBLIC_ARK_SERVER_URL && process.env.EXPO_PUBLIC_ARK_SERVER_PUBLIC_KEY && process.env.EXPO_PUBLIC_BOLTZ_API_URL)) {
    console.warn('env not set, skipping');
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

test.skip('arkade mainnet can create lightning invoice', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    console.warn('TEST_MNEMONIC not set, skipping');
    context.skip();
    return;
  }

  if (!(process.env.EXPO_PUBLIC_ARK_SERVER_URL && process.env.EXPO_PUBLIC_ARK_SERVER_PUBLIC_KEY && process.env.EXPO_PUBLIC_BOLTZ_API_URL)) {
    console.warn('env not set, skipping');
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

  await w.createLightningInvoice(500, 'GSOM OLOLO');
});

test.skip('arkade mainnet can pay lightning invoice', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    console.warn('TEST_MNEMONIC not set, skipping');
    context.skip();
    return;
  }

  if (!(process.env.EXPO_PUBLIC_ARK_SERVER_URL && process.env.EXPO_PUBLIC_ARK_SERVER_PUBLIC_KEY && process.env.EXPO_PUBLIC_BOLTZ_API_URL)) {
    console.warn('env not set, skipping');
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
