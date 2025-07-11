import assert from 'assert';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { expect, test, vi } from 'vitest';
import { EvmWallet } from '../../class/evm-wallet';
import { keyCleanupMiddleware } from '../../hooks/useBalance';
import { tokenBalanceFetcher } from '../../hooks/useTokenBalance';
import { getTokenList } from '../../models/token-list';
import { IBackgroundCaller } from '../../types/IBackgroundCaller';
import { NETWORK_BOTANIXTESTNET, NETWORK_ROOTSTOCK, NETWORK_SEPOLIA, NETWORK_STRATADEVNET } from '../../types/networks';
import { exchangeRateFetcher } from '../../hooks/useExchangeRate';

const backgroundCallerMock2: IBackgroundCaller = {
  log: () => Promise.resolve(),
  getWhitelist: async () => Promise.resolve([]),
  hasAcceptedTermsOfService: async () => Promise.resolve(false),
  hasMnemonic: async () => Promise.resolve(false),
  hasEncryptedMnemonic: async () => Promise.resolve(false),
  openPopup: () => Promise.resolve(),
  getAddress() {
    return Promise.resolve('');
  },
  acceptTermsOfService() {
    return Promise.resolve();
  },
  saveMnemonic() {
    throw new Error('Function not implemented.');
  },
  createMnemonic() {
    throw new Error('Function not implemented.');
  },
  encryptMnemonic() {
    throw new Error('Function not implemented.');
  },
  getBtcBalance() {
    throw new Error('Function not implemented.');
  },
  whitelistDapp() {
    throw new Error('Function not implemented.');
  },
  unwhitelistDapp() {
    throw new Error('Function not implemented.');
  },
  signPersonalMessage() {
    throw new Error('Function not implemented.');
  },
  signTypedData() {
    throw new Error('Function not implemented.');
  },
  getBtcSendData() {
    throw new Error('Function not implemented.');
  },
  getSubMnemonic() {
    throw new Error('Function not implemented.');
  },
};

test('can fetch balance', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    context.skip();
    return;
  }

  vi.spyOn(backgroundCallerMock2, 'getAddress').mockResolvedValueOnce(EvmWallet.xpubToAddress(EvmWallet.mnemonicToXpub(process.env.TEST_MNEMONIC), 0)); // test mnemonic account 0
  const balance = await keyCleanupMiddleware({
    cacheKey: 'balanceFetcher',
    network: NETWORK_SEPOLIA,
    accountNumber: 0,
    backgroundCaller: backgroundCallerMock2,
  });

  assert.ok(balance);
  assert.ok(new BigNumber(balance).gt(0));
});

test('can fetch STRATA balance', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    context.skip();
    return;
  }

  vi.spyOn(backgroundCallerMock2, 'getAddress').mockResolvedValueOnce(EvmWallet.xpubToAddress(EvmWallet.mnemonicToXpub(process.env.TEST_MNEMONIC), 0)); // test mnemonic account 0
  const balance = await keyCleanupMiddleware({
    cacheKey: 'balanceFetcher',
    network: NETWORK_STRATADEVNET,
    accountNumber: 0,
    backgroundCaller: backgroundCallerMock2,
  });

  assert.ok(balance);
  assert.ok(new BigNumber(balance).eq(0));
});

test('can fetch token balance', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    context.skip();
    return;
  }

  vi.spyOn(backgroundCallerMock2, 'getAddress').mockResolvedValueOnce(EvmWallet.xpubToAddress(EvmWallet.mnemonicToXpub(process.env.TEST_MNEMONIC), 0)); // test mnemonic account 0
  const balance = await tokenBalanceFetcher({
    cacheKey: 'tokenBalanceFetcher',
    network: NETWORK_ROOTSTOCK,
    accountNumber: 0,
    tokenContractAddress: '0xef213441A85dF4d7ACbDaE0Cf78004e1E486bB96',
    backgroundCaller: backgroundCallerMock2,
  });

  assert.ok(balance);
  assert.ok(+balance / 1e18 >= 1);
});

test('can fetch exchange rate', async (context) => {
  const rate = await exchangeRateFetcher({
    cacheKey: 'exchangeRateFetcher',
    network: NETWORK_ROOTSTOCK,
    fiat: 'USD',
  });

  assert.ok(rate);
  assert.ok(rate >= 50_000);

  const rate2 = await exchangeRateFetcher({
    cacheKey: 'exchangeRateFetcher',
    network: NETWORK_BOTANIXTESTNET,
    fiat: 'USD',
  });

  assert.strictEqual(rate2, 0);
});

test('can send ETH', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    context.skip();
    return;
  }

  const e = new EvmWallet();
  const fromAddress = EvmWallet.xpubToAddress(EvmWallet.mnemonicToXpub(process.env.TEST_MNEMONIC), 0);

  const paymentTransaction = await e.createPaymentTransaction(fromAddress, EvmWallet.xpubToAddress(EvmWallet.mnemonicToXpub(process.env.TEST_MNEMONIC), 1), (1e18).toString(10));
  const feeData = await e.getFeeData(NETWORK_SEPOLIA);
  const baseFee = await e.getBaseFeePerGas(NETWORK_SEPOLIA);
  const prepared = await e.prepareTransaction(paymentTransaction, NETWORK_SEPOLIA, feeData);

  const signed = await e.signTransaction(prepared, process.env.TEST_MNEMONIC, 0);

  const p = ethers.Transaction.from(signed);
  assert.strictEqual(p.chainId, 11155111n); // sepolia
  assert.ok(p.maxPriorityFeePerGas);
  assert.ok(p.maxFeePerGas);
  assert.ok(!p.gasPrice); // type2 tx, it has only maxPriorityFeePerGas & maxFeePerGas
  assert.ok(p.gasLimit);
  expect(p.maxPriorityFeePerGas).toBeGreaterThan(0);
  expect(p.maxFeePerGas).toBeGreaterThan(0);
  expect(p.gasLimit).toBeGreaterThan(0);
  expect(new BigNumber(p.nonce).toNumber()).toBeGreaterThan(0);

  const minFee = e.calculateMinFee(baseFee, prepared);
  expect(+minFee).toBeGreaterThan(0);

  const maxFee = e.calculateMaxFee(prepared);
  expect(+maxFee).toBeGreaterThan(0);
});

test('can send RSK', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    context.skip();
    return;
  }

  const e = new EvmWallet();
  const fromAddress = EvmWallet.xpubToAddress(EvmWallet.mnemonicToXpub(process.env.TEST_MNEMONIC), 1);

  const paymentTransaction = await e.createPaymentTransaction(fromAddress, EvmWallet.xpubToAddress(EvmWallet.mnemonicToXpub(process.env.TEST_MNEMONIC), 0), (1e15).toString(10));
  const feeData = await e.getFeeData(NETWORK_ROOTSTOCK);
  let baseFee = 0n; // await e.getBaseFeePerGas(NETWORK_ROOTSTOCK);
  const prepared = await e.prepareTransaction(paymentTransaction, NETWORK_ROOTSTOCK, feeData);

  const signed = await e.signTransaction(prepared, process.env.TEST_MNEMONIC, 1);

  const p = ethers.Transaction.from(signed);
  assert.strictEqual(p.chainId, 30n); // rsk
  assert.ok(p.gasPrice); // type0 tx
  assert.ok(p.gasLimit);
  assert.ok(p.type === 0);

  const minFee = e.calculateMinFee(baseFee, prepared);
  expect(+minFee).toBeGreaterThan(0);

  const maxFee = e.calculateMaxFee(prepared);
  expect(+maxFee).toBeGreaterThan(0);
});

test('transfer ERC-20 token', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    context.skip();
    return;
  }

  const list = getTokenList(NETWORK_ROOTSTOCK);
  const erc20token = list.find((token) => token.name === 'rUSDT');
  assert(erc20token);

  const e = new EvmWallet();
  const fromAddress = EvmWallet.xpubToAddress(EvmWallet.mnemonicToXpub(process.env.TEST_MNEMONIC), 0);
  const toAddress = EvmWallet.xpubToAddress(EvmWallet.mnemonicToXpub(process.env.TEST_MNEMONIC), 1);

  const paymentRequest = await e.createTokenTransferTransaction(fromAddress, toAddress, erc20token, (1e18).toString(10));
  assert.ok(paymentRequest.data);
  assert.ok(paymentRequest.from);
  assert.ok(paymentRequest.to);
  assert.strictEqual(
    paymentRequest.data,
    // eslint-disable-next-line max-len
    '0xa9059cbb000000000000000000000000ce1f1e9cfda753a3a7219660c80d96e54de1f2ed0000000000000000000000000000000000000000000000000de0b6b3a7640000'
  );

  const feeData = await e.getFeeData(NETWORK_ROOTSTOCK);
  let baseFee;
  try {
    baseFee = await e.getBaseFeePerGas(NETWORK_ROOTSTOCK);
  } catch (_) {
    baseFee = 0n;
  }
  const prepared = await e.prepareTransaction(paymentRequest, NETWORK_ROOTSTOCK, feeData);

  const signed = await e.signTransaction(prepared, process.env.TEST_MNEMONIC, 0);

  const p = ethers.Transaction.from(signed);
  assert.strictEqual(p.chainId, 30n); // rootstock
  assert.ok(!p.maxPriorityFeePerGas); // empty cause its type0 tx
  assert.ok(!p.maxFeePerGas); // empty cause its type0 tx
  assert.ok(p.gasPrice); // type0 tx has it
  assert.ok(p.gasLimit);
  assert.ok(p.type === 0);
  expect(p.gasLimit).toBeGreaterThan(0);
  expect(p.gasPrice).toBeGreaterThan(0);

  const minFee = e.calculateMinFee(baseFee, prepared);
  expect(+minFee).toBeGreaterThan(0);

  const maxFee = e.calculateMaxFee(prepared);
  expect(+maxFee).toBeGreaterThan(0);
});
