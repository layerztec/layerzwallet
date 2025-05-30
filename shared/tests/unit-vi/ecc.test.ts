import assert from 'assert';
import { ECPairFactory } from 'ecpair';
import { beforeEach, describe, it, vi as jest } from 'vitest';

import ecc from '@bitcoinerlab/secp256k1';

const h = (hex: string) => Buffer.from(hex, 'hex');

beforeEach(() => {
  jest.resetModules();
});

describe('ecc', () => {
  /**
   * @see https://github.com/jestjs/jest/issues/4422
   */
  it('Buffer instanceof Uint8Array', () => {
    const b = Buffer.from('ff');
    assert.ok(b instanceof Uint8Array);
  });

  it('ECPair accepts noble', () => {
    const ECPair = ECPairFactory(ecc);
    assert.ok(ECPair);
  });

  it('works (basic)', () => {
    assert.ok(ecc.isPoint(Buffer.from('0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798', 'hex')));
    assert.ok(!ecc.isPoint(Buffer.from('0100000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001', 'hex')));
    assert.ok(!ecc.isPoint(Buffer.from('00', 'hex')));

    /*

        muted because of that:

        ```
            if (!isWithinCurveOrder(num))
            throw new Error('Expected private key: 0 < key < n');
        ````

        in `node_modules/@noble/secp256k1/lib/index.js`
        (this test runs in runtime in some versions if `ECPairFactory`)


        const rez = ecc.privateAdd(
          h('0000000000000000000000000000000000000000000000000000000000000001'),
          h('0000000000000000000000000000000000000000000000000000000000000000'),
        );


        assert.strictEqual(
          Buffer.from(rez).toString('hex'),
          h('0000000000000000000000000000000000000000000000000000000000000001').toString('hex'),
        );
    */

    const rez2 = ecc.privateAdd(h('fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd036413e'), h('0000000000000000000000000000000000000000000000000000000000000003'));
    assert.strictEqual(rez2, null);

    assert.ok(!ecc.isPrivate(h('0000000000000000000000000000000000000000000000000000000000000000')));
  });
});
