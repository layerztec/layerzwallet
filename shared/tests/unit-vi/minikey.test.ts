import { expect, test } from 'vitest';
import '../../class/wallets/hd-segwit-bech32-wallet';
import { LegacyWallet } from '../../class/wallets/legacy-wallet';

test('minikey is converted to WIF', () => {
  // example from https://en.bitcoin.it/wiki/Mini_private_key_format
  const w = new LegacyWallet();
  w.setSecret('S6c56bnXQiBjk9mqSYE7ykVQ7NzrRy');
  expect(w.getSecret()).toBe('5JPy8Zg7z4P7RSLsiqcqyeAF1935zjNUdMxcDeVrtU1oarrgnB7');
});
