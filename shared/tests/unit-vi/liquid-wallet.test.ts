import assert from 'assert';
import { test } from 'vitest';
import { LiquidWallet } from '../../class/wallets/liquid-wallet';

const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

test('can generate for mainnet', async () => {
  const wallet = new LiquidWallet();
  const pub = wallet.generateXpubAndMasterBlindingKey(mnemonic);
  assert.deepStrictEqual(pub, {
    xpub: 'xpub6CRFzUgHFDaiDAQFNX7VeV9JNPDRabq6NYSpzVZ8zW8ANUCiDdenkb1gBoEZuXNZb3wPc1SVcDXgD2ww5UBtTb8s8ArAbTkoRQ8qn34KgcY',
    masterBlindingKey: '9c8e4f05c7711a98c838be228bcb84924d4570ca53f35fa1c793e58841d47023',
  });
  await wallet.init(pub);
  assert.strictEqual(wallet.getDerivationPath(), "m/84'/1776'/0'");
  assert.strictEqual(wallet.getMasterBlindingKey(), '9c8e4f05c7711a98c838be228bcb84924d4570ca53f35fa1c793e58841d47023');
  assert.strictEqual(wallet._getExternalAddressByIndex(0), 'ex1qyuh42lps6t6jpdk54cwmmhd27zrs3yulrc7t5a');
  assert.strictEqual(wallet.isAddressValid('ex1qyuh42lps6t6jpdk54cwmmhd27zrs3yulrc7t5a'), true);
  assert.strictEqual(wallet.isAddressValid('lq1qqvxk052kf3qtkxmrakx50a9gc3smqad2ync54hzntjt980kfej9kkfe0247rp5h4yzmdftsahhw64uy8pzfe7cpg4fgykm7cv'), true);
  assert.strictEqual(wallet.isAddressValid('tex1q6rz28mcfaxtmd6v789l9rrlrusdprr9p634wu8'), false);
  assert.strictEqual(wallet.isAddressValid('xxx'), false);
});

test('can generate for testnet', async () => {
  const wallet = new LiquidWallet('testnet');
  const pub = wallet.generateXpubAndMasterBlindingKey(mnemonic);
  assert.deepStrictEqual(pub, {
    xpub: 'xpub6Bm9M1SxZdzL3TxdNV8897FgtTLBgehR1wVNnMyJ5VLRK5n3tFqXxrCVnVQj4zooN4eFSkf6Sma84reWc5ZCXMxPbLXQs3BcaBdTd4YQa3B',
    masterBlindingKey: '9c8e4f05c7711a98c838be228bcb84924d4570ca53f35fa1c793e58841d47023',
  });
  await wallet.init(pub);
  assert.strictEqual(wallet.getDerivationPath(), "m/84'/1'/0'");
  assert.strictEqual(wallet.getMasterBlindingKey(), '9c8e4f05c7711a98c838be228bcb84924d4570ca53f35fa1c793e58841d47023');
  assert.strictEqual(wallet._getExternalAddressByIndex(0), 'tex1q6rz28mcfaxtmd6v789l9rrlrusdprr9p634wu8');
  assert.strictEqual(wallet.isAddressValid('tex1q6rz28mcfaxtmd6v789l9rrlrusdprr9p634wu8'), true);
  assert.strictEqual(wallet.isAddressValid('tlq1qq2xvpcvfup5j8zscjq05u2wxxjcyewk7979f3mmz5l7uw5pqmx6xf5xy50hsn6vhkm5euwt72x878eq6zxx2z58hd7zrsg9qn'), true);
  assert.strictEqual(wallet.isAddressValid('ex1qyuh42lps6t6jpdk54cwmmhd27zrs3yulrc7t5a'), false);
  assert.strictEqual(wallet.isAddressValid('xxx'), false);
});

test('throws if fetchTransactions is called without connect', async () => {
  const wallet = new LiquidWallet('liquid', false); // do not connect
  const pub = wallet.generateXpubAndMasterBlindingKey(mnemonic);
  await wallet.init(pub);
  await assert.rejects(async () => {
    await wallet.fetchTransactions();
  }, /Wallet is not connected/);
});
