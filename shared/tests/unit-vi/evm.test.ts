import assert from 'assert';
import { test, expect } from 'vitest';
import { EvmWallet } from '../../class/evm-wallet';
import { getTokenList } from '../../models/token-list';
import { NETWORK_ROOTSTOCK } from '../../types/networks';
import { hexStr, hexToDec } from '../../modules/string-utils';
import { ICsprng } from '../../types/ICsprng';

const typedDataV4 = {
  domain: {
    chainId: '1',
    name: 'Ether Mail',
    verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
    version: '1',
  },
  message: {
    contents: 'Hello, Bob!',
    from: {
      name: 'Cow',
      wallets: ['0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826', '0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF'],
    },
    to: [
      {
        name: 'Bob',
        wallets: ['0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB', '0xB0BdaBea57B0BDABeA57b0bdABEA57b0BDabEa57', '0xB0B0b0b0b0b0B000000000000000000000000000'],
      },
    ],
    attachment: '0x',
  },
  primaryType: 'Mail',
  types: {
    EIP712Domain: [
      {
        name: 'name',
        type: 'string',
      },
      {
        name: 'version',
        type: 'string',
      },
      {
        name: 'chainId',
        type: 'uint256',
      },
      {
        name: 'verifyingContract',
        type: 'address',
      },
    ],
    Group: [
      {
        name: 'name',
        type: 'string',
      },
      {
        name: 'members',
        type: 'Person[]',
      },
    ],
    Mail: [
      {
        name: 'from',
        type: 'Person',
      },
      {
        name: 'to',
        type: 'Person[]',
      },
      {
        name: 'contents',
        type: 'string',
      },
      {
        name: 'attachment',
        type: 'bytes',
      },
    ],
    Person: [
      {
        name: 'name',
        type: 'string',
      },
      {
        name: 'wallets',
        type: 'address[]',
      },
    ],
  },
};

test('sign typed data v4', async () => {
  const e = new EvmWallet();
  const signature = await e.signTypedDataMessage(typedDataV4, 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', 0);
  assert.strictEqual(signature, '0xee7139a407f08d2ac90f7306cea0ecc93b7f81298ca1e8fac057bf90214d6d0127de280923f3e71b5978c5f7df41cad265339592ac277188a273ba14f340404f1b');
});

test('personal sign', async () => {
  const e = new EvmWallet();
  const signature = await e.signPersonalMessage('hello world', 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', 0);
  expect(signature).toEqual('0xae35d9375b015664a7b115a63a4515142b68059b164dd187e0b5232d47ca69685104d05d1c6c58b1fe5842f28459e2ea5bd571c0196f10da25fd2140eeef47e51c');
});

test('personal sign hex', async () => {
  const payload = '0xffffffffffffffffffffffffffffffff';
  const e = new EvmWallet();
  const bytes = await e.signPersonalMessage(payload, 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', 0);
  assert.strictEqual(bytes, '0x9bca5aaaf287b1c1a133e52f3bc1a04f4c752380c20dd79d75c34285fa5eda42064c44f2a5c92b72c1b864e026dcf1d5b6f4b59d0a0c048ce70674a0c2f913411c');
});

test('isMnemonicValid()', () => {
  expect(EvmWallet.isMnemonicValid('gsom')).toEqual(false);
  expect(EvmWallet.isMnemonicValid('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about')).toEqual(true);
});

test('isAddressValid()', () => {
  expect(EvmWallet.isAddressValid('sadgsdg')).toBeFalsy();
  expect(EvmWallet.isAddressValid('')).toBeFalsy();
  expect(EvmWallet.isAddressValid('0x9858EfFD232B4033E47d90003D41EC34EcaEda94')).toBeTruthy();
});

test('generateMnemonic()', async () => {
  const rng: ICsprng = {
    randomBytes: async (length: number) => new Uint8Array(length).fill(0),
  };

  const mnemonic = await EvmWallet.generateMnemonic(rng);
  expect(mnemonic).toEqual('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
  expect(EvmWallet.isMnemonicValid(mnemonic)).toBeTruthy();
});

test('HD stuff', () => {
  const xpub = EvmWallet.mnemonicToXpub('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
  expect(xpub).toEqual('xpub6EF8jXqFeFEW5bwMU7RpQtHkzE4KJxcqJtvkCjJumzW8CPpacXkb92ek4WzLQXjL93HycJwTPUAcuNxCqFPKKU5m5Z2Vq4nCyh5CyPeBFFr');

  expect(EvmWallet.xpubToAddress(xpub, 0)).toEqual('0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
  expect(EvmWallet.xpubToAddress(xpub, 1)).toEqual('0x6Fac4D18c912343BF86fa7049364Dd4E424Ab9C0');
});

test('util', () => {
  assert.strictEqual(hexToDec('0x1'), 1);
  assert.strictEqual(hexToDec('0xff'), 255);
  assert.strictEqual(hexToDec('ff'), 255);
  assert.strictEqual(hexToDec(255), 255);

  assert.strictEqual(hexStr(-1), '-0x1');
  assert.strictEqual(hexToDec('-0x1'), -1);
});

test('getTokenList', () => {
  const list = getTokenList(NETWORK_ROOTSTOCK);

  expect(list.length).toBeGreaterThan(0);
  assert.ok(list.find((token) => token.name === 'rUSDT'));
});
