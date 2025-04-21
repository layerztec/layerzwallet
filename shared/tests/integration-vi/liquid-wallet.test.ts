import assert from 'assert';
import { networks, Transaction } from 'liquidjs-lib';
import { describe, expect, it } from 'vitest';
import { LiquidWallet } from '../../class/wallets/liquid-wallet';

describe('Liquid wallet', () => {
  it('can fetch transactions and balances and sign the transaction', async () => {
    if (!process.env.TEST_MNEMONIC) {
      console.warn('skipped because TEST_MNEMONIC env var is not set');
      return;
    }

    const w = new LiquidWallet('testnet');
    const mnemonic = process.env.TEST_MNEMONIC;
    const pub = w.generateXpubAndMasterBlindingKey(mnemonic);
    assert.deepStrictEqual(pub, {
      xpub: 'xpub6CKEM4rUqvTLhRHQfq1eHQaDf9z6u8Ccg3K9ATYsnGkqQAd7xvEeQRL2WpyU4ZnwjW34GcJkfeFVQtP6YtK3PzbpnmTQcJ9BNJn4wmrLHp1',
      masterBlindingKey: '593789fd3f7c804f1a169062402d922008e7b438770521d4fc689cf24307dbbd',
    });
    await w.init(pub);
    const xpub = w._zpubToXpub(w.getXpub());
    assert.strictEqual(xpub, pub.xpub);
    assert.strictEqual(w._getExternalAddressByIndex(0), 'tex1q5uj2tkdhw7mshl7w8k95g8c2a8gr7nkrt3vgsq');
    assert.strictEqual(w._getExternalAddressByIndex(1), 'tex1q0ewpz77x9et7eah3awlsrgy822nl2tx4dwxsc5');
    assert.strictEqual(w.getChangeConfidentialAddress(), 'tlq1qqw98w9cty40vuqna8s0pquxtzfu6ltpavy5d32hr9qj3vhazz30q65e2mnfjx9y90nx47nxamlj6phnej2le5lx8jv5d6yehr');
    assert.strictEqual(w.getMasterBlindingKey(), pub.masterBlindingKey);

    const ping = await w.wsclient.batchRequest({ method: 'server.ping', params: [] });
    assert.strictEqual(ping[0], null);

    assert.strictEqual(await w.getAddressAsync(), 'tlq1qq0dma4k57hzwyqrx03hnjcl4507rm5yyt37jd6lrjr7pss2hs3832ljuz9auvtjhanm0r6alqxsgw54875kd2hpcv6h8g87t9');

    await w.fetchTransactions();

    const utxos = w.getUtxos();

    assert.deepStrictEqual(utxos, [
      {
        txid: '0e5bc999b84b0ba6466f0061fe37ce062a28cdd5b3732d9bae76ea0cb62b7246',
        vout: 0,
        blindingData: {
          value: 10000,
          asset: '144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49',
          assetBlindingFactor: 'f3c995f4556f865309450893c350c91aa5f9bc1fb20b6b5d45ac427319d7b6c5',
          valueBlindingFactor: 'b25d144c3888bec2137bb21553cdb2a3f21b50f8b4f8757ae9469429ad6ce985',
        },
      },
      {
        txid: '2a66abfcfc60c6b939f8fcf0a0894d5c892795e58cec428b3413e14ba0083716',
        vout: 0,
        blindingData: {
          value: 10000,
          asset: '144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49',
          assetBlindingFactor: '2336ba2a80c033136195ce8e02aa44999aeaa3ecce71903b6ba78094887693fd',
          valueBlindingFactor: 'c4d4fd988f30eb3e1de9d71f7f4d40021d5cc1c8a6461411119fb026c2a289a5',
        },
      },
      {
        txid: '2a66abfcfc60c6b939f8fcf0a0894d5c892795e58cec428b3413e14ba0083716',
        vout: 1,
        blindingData: {
          value: 10000,
          asset: '144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49',
          assetBlindingFactor: 'e906c5a03adefa5a80326236f519d88d3d35c520761be167d9fcb1b0fb1127fe',
          valueBlindingFactor: 'd16ae573320cdec430e26917aac7c3e0a5d67d0c2ec929b8dfd3263e31e25d73',
        },
      },
    ]);

    w.next_free_address_index = 1;

    const balances = w.getBalances();
    assert.deepStrictEqual(balances, {
      '144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49': 30000,
    });

    const a1 = 'tlq1qqgeavtll8n8fd4kjlxqa7jdzhmk3vjsd7xcvs9kjknana9x7fje2vqc78uefj8ne004eezdrx43jq9ftud2d68clcj2s8hg3z';
    const a2 = 'tlq1qq0at9w70t5gacjxpsts7p5eeulmzvzqv4l44c6y7ruu77qtxndhl4v7hqzvz6ty8y2kt2v08dz80fgs3a4jrjhfczprteynrw';
    const asset = networks.testnet.assetHash;

    // use only one input
    const one = w.createTransaction(utxos, 0.000001, [{ address: a1, asset, value: 1000 }]);
    assert.strictEqual(one.fee, 273);
    assert.strictEqual(one.pset.inputs.length, 1);

    // use two inputs
    const two = w.createTransaction(utxos, 0.000001, [{ address: a1, asset, value: 15000 }]);
    assert.strictEqual(two.fee, 281);
    assert.strictEqual(two.pset.inputs.length, 2);

    // use three inputs, create two outputs, sign transaction
    const three = w.createTransaction(utxos, 0.000001, [
      { address: a1, asset, value: 15000 },
      { address: a2, asset, value: 10000 },
    ]);
    assert.strictEqual(three.fee, 418);
    assert.strictEqual(three.pset.inputs.length, 3);

    const final = w.signAndFinalize(three.pset, mnemonic);

    expect(final.tx).toBeTruthy();
    const transaction = Transaction.fromHex(final.tx);
    expect(transaction.ins).toHaveLength(3);
    expect(transaction.outs).toHaveLength(4); // 2 outputs, 1 change, 1 fee
  });
});
