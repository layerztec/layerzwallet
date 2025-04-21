import assert from 'assert';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { expect, test, vi } from 'vitest';
import { EvmWallet } from '../../class/evm-wallet';
import { balanceFetcher } from '../../hooks/useBalance';
import { tokenBalanceFetcher } from '../../hooks/useTokenBalance';
import { getTokenList } from '../../models/token-list';
import {
  GetLiquidBalanceResponse,
  GetLiquidSendDataResponse,
  CreateMnemonicResponse,
  EncryptMnemonicResponse,
  GetBtcBalanceResponse,
  GetBtcSendDataResponse,
  IBackgroundCaller,
  SaveMnemonicResponse,
  SignPersonalMessageResponse,
  SignTypedDataResponse,
} from '../../types/IBackgroundCaller';
import { NETWORK_ROOTSTOCK, NETWORK_SEPOLIA, NETWORK_STRATADEVNET, Networks } from '../../types/networks';

const backgroundCallerMock2: IBackgroundCaller = {
  log: () => Promise.resolve(),
  getWhitelist: async () => Promise.resolve([]),
  hasAcceptedTermsOfService: async () => Promise.resolve(false),
  hasMnemonic: async () => Promise.resolve(false),
  hasEncryptedMnemonic: async () => Promise.resolve(false),
  openPopup: () => Promise.resolve(),
  getAddress: function (network: Networks, accountNumber: number): Promise<string> {
    return Promise.resolve('');
  },
  acceptTermsOfService: function (): Promise<void> {
    return Promise.resolve();
  },
  saveMnemonic: function (mnemonic: string): Promise<SaveMnemonicResponse> {
    throw new Error('Function not implemented.');
  },
  createMnemonic: function (): Promise<CreateMnemonicResponse> {
    throw new Error('Function not implemented.');
  },
  encryptMnemonic: function (password: string): Promise<EncryptMnemonicResponse> {
    throw new Error('Function not implemented.');
  },
  getBtcBalance: function (accountNumber: number): Promise<GetBtcBalanceResponse> {
    throw new Error('Function not implemented.');
  },
  whitelistDapp: function (dapp: string): Promise<void> {
    throw new Error('Function not implemented.');
  },
  unwhitelistDapp: function (dapp: string): Promise<void> {
    throw new Error('Function not implemented.');
  },
  signPersonalMessage: function (message: string | Uint8Array, accountNumber: number, password: string): Promise<SignPersonalMessageResponse> {
    throw new Error('Function not implemented.');
  },
  signTypedData: function (message: any, accountNumber: number, password: string): Promise<SignTypedDataResponse> {
    throw new Error('Function not implemented.');
  },
  getBtcSendData: function (accountNumber: number): Promise<GetBtcSendDataResponse> {
    throw new Error('Function not implemented.');
  },
  getLiquidBalance(accountNumber: number): Promise<GetLiquidBalanceResponse> {
    throw new Error('Function not implemented.');
  },
  getLiquidSendData(accountNumber: number): Promise<GetLiquidSendDataResponse> {
    throw new Error('Function not implemented.');
  },
};

test('can fetch balance', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    context.skip();
    return;
  }

  vi.spyOn(backgroundCallerMock2, 'getAddress').mockResolvedValueOnce(EvmWallet.xpubToAddress(EvmWallet.mnemonicToXpub(process.env.TEST_MNEMONIC), 0)); // test mnemonic account 0
  const balance = await balanceFetcher({
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
  const balance = await balanceFetcher({
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
