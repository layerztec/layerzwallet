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

  test('can check if issued invoice is paid', async (context) => {
    if (!process.env.TEST_MNEMONIC) {
      console.log('TEST_MNEMONIC not set, skipping');
      context.skip();
      return;
    }

    const w = new SparkWallet();
    w.setSecret(process.env.TEST_MNEMONIC);
    await w.init();

    // @ts-ignore messing with internals to test it
    w._bolt11toReceiveRequestId[
      'lnbc10n1p5x8nq5pp55de33575jrcz8enxjuzq5mm66hs5jfyaa5fds3s9le6xagdxae7ssp5du088t4c0k5x8z0dv6t4uw4tsenxzs4e0t8m7ke89kanprmykuzqxq9z0rgqnp4qvyndeaqzman7h898jxm98dzkm0mlrsx36s93smrur7h0azyyuxc5rzjq25carzepgd4vqsyn44jrk85ezrpju92xyrk9apw4cdjh6yrwt5jgqqqqrt49lmtcqqqqqqqqqqq86qq9qrzjqwghf7zxvfkxq5a6sr65g0gdkv768p83mhsnt0msszapamzx2qvuxqqqqrt49lmtcqqqqqqqqqqq86qq9qcqzpgdq8w3jhxaq9qyyssqrj43wj4eh8ekdff9k0pnfw8ggclu8cgymzat8s0uhtnnt0gl8pcy9x5n3rtelngt3gdd879vathhqmtrwqv4zq2s5s5gchkmnwjhflqqdjkstc'
    ] = 'SparkLightningReceiveRequest:0197c5d5-2ea2-cd96-0000-d91759d99484';

    // @ts-ignore messing with internals to test it
    w._bolt11toReceiveRequestId[
      'lnbc20n1p5x8n27pp5p6tlgver47r3ftruqhsayltdhsutgmxfjycn8j52ffp44ccenyzssp5y488hs9t07jhx8d8zgpl6w0l3kfl030rqr8wm0kz055436ugknesxq9z0rgqnp4qvyndeaqzman7h898jxm98dzkm0mlrsx36s93smrur7h0azyyuxc5rzjq25carzepgd4vqsyn44jrk85ezrpju92xyrk9apw4cdjh6yrwt5jgqqqqrt49lmtcqqqqqqqqqqq86qq9qrzjqwghf7zxvfkxq5a6sr65g0gdkv768p83mhsnt0msszapamzx2qvuxqqqqrt49lmtcqqqqqqqqqqq86qq9qcqzpgdq8w3jhxaq9qyyssq3p29at57ys454qfan6akp8pcld9shevpyfkvgz3jksc8u4605kfxhwtk764vryguuuq054fglfyf0nzvvkehzj3d0wlxp9apds9h7xqqggpqwx'
    ] = 'SparkLightningReceiveRequest:0197c5da-39da-cd96-0000-449ca8c8413b';

    const paid = await w.isInvoicePaid(
      'lnbc10n1p5x8nq5pp55de33575jrcz8enxjuzq5mm66hs5jfyaa5fds3s9le6xagdxae7ssp5du088t4c0k5x8z0dv6t4uw4tsenxzs4e0t8m7ke89kanprmykuzqxq9z0rgqnp4qvyndeaqzman7h898jxm98dzkm0mlrsx36s93smrur7h0azyyuxc5rzjq25carzepgd4vqsyn44jrk85ezrpju92xyrk9apw4cdjh6yrwt5jgqqqqrt49lmtcqqqqqqqqqqq86qq9qrzjqwghf7zxvfkxq5a6sr65g0gdkv768p83mhsnt0msszapamzx2qvuxqqqqrt49lmtcqqqqqqqqqqq86qq9qcqzpgdq8w3jhxaq9qyyssqrj43wj4eh8ekdff9k0pnfw8ggclu8cgymzat8s0uhtnnt0gl8pcy9x5n3rtelngt3gdd879vathhqmtrwqv4zq2s5s5gchkmnwjhflqqdjkstc'
    );

    const paid2 = await w.isInvoicePaid(
      'lnbc20n1p5x8n27pp5p6tlgver47r3ftruqhsayltdhsutgmxfjycn8j52ffp44ccenyzssp5y488hs9t07jhx8d8zgpl6w0l3kfl030rqr8wm0kz055436ugknesxq9z0rgqnp4qvyndeaqzman7h898jxm98dzkm0mlrsx36s93smrur7h0azyyuxc5rzjq25carzepgd4vqsyn44jrk85ezrpju92xyrk9apw4cdjh6yrwt5jgqqqqrt49lmtcqqqqqqqqqqq86qq9qrzjqwghf7zxvfkxq5a6sr65g0gdkv768p83mhsnt0msszapamzx2qvuxqqqqrt49lmtcqqqqqqqqqqq86qq9qcqzpgdq8w3jhxaq9qyyssq3p29at57ys454qfan6akp8pcld9shevpyfkvgz3jksc8u4605kfxhwtk764vryguuuq054fglfyf0nzvvkehzj3d0wlxp9apds9h7xqqggpqwx'
    );

    assert.ok(paid);
    assert.ok(paid2);
  });
});
