import assert from 'assert';
import { describe, test } from 'vitest';

import { BreezWallet } from '../../class/wallets/breez-wallet';

describe('BreezWallet getSendQuote', () => {
  test('returns quote on Liquid (or throws not enough funds)', async (context) => {
    if (!process.env.TEST_MNEMONIC) {
      console.warn('TEST_MNEMONIC not set, skipping');
      context.skip();
      return;
    }

    const wallet = new BreezWallet(process.env.TEST_MNEMONIC, 'mainnet');

    // Generate a valid address from the wallet itself
    const toAddress = await wallet.getAddressLiquid();
    assert.ok(toAddress, 'should generate a valid Liquid address');

    // Breez SDK checks balance during prepareSendPayment. If the wallet has no
    // funds it throws "not enough funds" — which still proves the API path works
    // (address validated, SDK initialized, quote attempted).
    try {
      const quote = await wallet.getSendQuote({
        toAddress,
        amount: '1000',
      });

      assert.ok(quote.fee !== undefined, 'fee should be set');
      assert.ok(Number(quote.fee) >= 0, 'fee should be >= 0');
      assert.equal(quote.feeTicker, 'L-BTC');
      assert.ok(quote._prepared, '_prepared should be set');
    } catch (e: any) {
      if (e.message?.includes('not enough funds')) {
        // Expected when test wallet has no Liquid balance — test still passes
        console.log('BreezWallet.getSendQuote: wallet has no funds (expected for unfunded test wallet)');
        return;
      }
      throw e;
    }
  });
});
