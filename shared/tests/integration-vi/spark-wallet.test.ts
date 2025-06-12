import assert from 'assert';
import { test, describe } from 'vitest';
import { SparkWallet } from '../../class/wallets/spark-wallet';

// fyi, spark adapter is set up in vitest.config.mts (uses the one for extension)
describe('SparkWallet', () => {
  test('can get balance', async (context) => {
    if (!process.env.TEST_MNEMONIC) {
      console.log('TEST_MNEMONIC not set, skipping');
      context.skip();
      return;
    }

    const w = new SparkWallet();
    w.setSecret(process.env.TEST_MNEMONIC);
    await w.init();

    assert.strictEqual(await w.getOffchainReceiveAddress(), 'sp1pgssx2srkm6344nxzngx9n8stj5uxp544dgm3mrdgpeulr8phutzdx89q62t0n');
    assert.ok((await w.getOffchainBalance()) >= 1);
    // console.log('balance=', await w.getOffchainBalance());
  });

  test.skip('can check ln invoice status', async (context) => {
    if (!process.env.TEST_MNEMONIC) {
      console.log('TEST_MNEMONIC not set, skipping');
      context.skip();
      return;
    }

    const w = new SparkWallet();
    w.setSecret(process.env.TEST_MNEMONIC);
    await w.init();

    const invoice = await w.checkLnInvoiceById('');
    assert.ok(invoice?.invoice.encodedInvoice);
  });

  test('can get txs', async (context) => {
    if (!process.env.TEST_MNEMONIC) {
      console.log('TEST_MNEMONIC not set, skipping');
      context.skip();
      return;
    }

    const w = new SparkWallet();
    w.setSecret(process.env.TEST_MNEMONIC);
    await w.init();

    const txs = await w.getTransaction();
    assert.ok(txs.length >= 1);
  });

  test.skip('can send spark payment', async (context) => {
    if (!process.env.TEST_MNEMONIC) {
      console.log('TEST_MNEMONIC not set, skipping');
      context.skip();
      return;
    }

    const w = new SparkWallet();
    w.setSecret(process.env.TEST_MNEMONIC);
    await w.init();

    const result = await w.pay('sp1pgss9rmd7lf5y6y93jtd3fl920lq8mqhnew069chmrvschlt74th2afzyt8qcl', 10);
    console.log(result);
    assert.ok(result);
  });

  test.skip('can pay ln', async (context) => {
    if (!process.env.TEST_MNEMONIC) {
      console.log('TEST_MNEMONIC not set, skipping');
      context.skip();
      return;
    }

    const w = new SparkWallet();
    w.setSecret(process.env.TEST_MNEMONIC);
    await w.init();

    await w.payLightningInvoice(
      'lnbc4u1p5z7y4cpp5vzjkl2svmtyt2d8q9f5clsch5ppemt8320spdj24kve45gq9uvesdqqcqzysxqyz5vqsp5rfv2fel3smq2sxerf664w0mmtnexl6yweenf0dftpujhftcvfayq9qxpqysgqkzlnzf7nrv3qhduf9dkrcc599d04674afkgfewkxtk060h8d92v8zzlwpg3yc7utfkzezvp2geld00fe4ggrmvp6klltkzvkxfal7qcq79eqvg'
    );
  });

  test.skip('can receive ln', async (context) => {
    if (!process.env.TEST_MNEMONIC) {
      console.log('TEST_MNEMONIC not set, skipping');
      context.skip();
      return;
    }

    const w = new SparkWallet();
    w.setSecret(process.env.TEST_MNEMONIC);
    await w.init();

    await w.createLightningInvoice(667, 'test');
  });
});
