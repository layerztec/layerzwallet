import assert from 'assert';
import { ECPairFactory } from 'ecpair';
import { beforeEach, describe, it, vi as jest } from 'vitest';

import ecc from '@bitcoinerlab/secp256k1';
import { hexToUint8Array, uint8ArrayToHex } from '../../modules/uint8array-extras';

const h = (hex: string) => hexToUint8Array(hex);

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
    assert.ok(ecc.isPoint(hexToUint8Array('0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798')));
    assert.ok(!ecc.isPoint(hexToUint8Array('0100000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001')));
    assert.ok(!ecc.isPoint(hexToUint8Array('00')));

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
          uint8ArrayToHex(rez),
          uint8ArrayToHex(h('0000000000000000000000000000000000000000000000000000000000000001')),
        );
    */

    const rez2 = ecc.privateAdd(h('fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd036413e'), h('0000000000000000000000000000000000000000000000000000000000000003'));
    assert.strictEqual(rez2, null);

    assert.ok(!ecc.isPrivate(h('0000000000000000000000000000000000000000000000000000000000000000')));
  });
});
