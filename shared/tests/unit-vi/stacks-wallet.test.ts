import { test } from 'vitest';

import { StacksWallet } from '../../class/wallets/stacks-wallet';
import { MCP_BALANCE_ACCOUNT_NUMBER } from '../../hooks/AccountNumberContext';
import assert from 'assert';

/** BIP39 test vector; must match hardcoded addresses below. */
const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const storageMock = {
  async setItem(key: string, value: string) {},
  async getItem(key: string) {
    return '';
  },
};

test('stacks wallet derives expected addresses', async () => {
  const w = new StacksWallet();
  w.setSecret(TEST_MNEMONIC);
  await w.init(storageMock);

  w.setAccountNumber(0);
  assert.strictEqual(await w.getOffchainReceiveAddress(), 'SPC5KHM41H6WHAST7MWWDD807YSPRQKJ69FSH54J');

  w.setAccountNumber(1);
  assert.strictEqual(await w.getOffchainReceiveAddress(), 'SP3XHES5990FYDV5BHBZCJRFYFD2Z4X3FMD2N3MGH');

  w.setAccountNumber(2);
  assert.strictEqual(await w.getOffchainReceiveAddress(), 'SP28B7Q9N0NDJSRTGXRWF53B5M08BEV7G32MTC87V');

  w.setAccountNumber(0);
  assert.strictEqual(await w.getOffchainReceiveAddress(), 'SPC5KHM41H6WHAST7MWWDD807YSPRQKJ69FSH54J');

  const started = Date.now();
  w.setAccountNumber(MCP_BALANCE_ACCOUNT_NUMBER);
  assert.strictEqual(await w.getOffchainReceiveAddress(), 'SP2M4PRZZR8BQ5YCJSQBTMBAXMX0SFWB4284RCY12');
  assert.ok(Date.now() - started < 2_000, 'high account derivation should be near-instant');
});
