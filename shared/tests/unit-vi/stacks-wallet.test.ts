import assert from 'assert';
import { AuthType } from '@stacks/transactions';
import { beforeEach, describe, expect, it, test, vi } from 'vitest';

import { StacksWallet } from '../../class/wallets/stacks-wallet';

const makeContractCallMock = vi.fn();
const makeSTXTokenTransferMock = vi.fn();
const broadcastTransactionMock = vi.fn();

vi.mock('@stacks/transactions', async () => {
  const actual = await vi.importActual<typeof import('@stacks/transactions')>('@stacks/transactions');
  return {
    ...actual,
    makeContractCall: (...args: any[]) => makeContractCallMock(...args),
    makeSTXTokenTransfer: (...args: any[]) => makeSTXTokenTransferMock(...args),
    broadcastTransaction: (...args: any[]) => broadcastTransactionMock(...args),
  };
});

const storageMock = {
  async setItem(key: string, value: string) {},
  async getItem(key: string) {
    return '';
  },
};

test('stacks wallet can generate addresses for different accounts', async (context) => {
  if (!process.env.TEST_MNEMONIC) {
    console.warn('TEST_MNEMONIC not set, skipping');
    context.skip();
    return;
  }

  const w = new StacksWallet();
  w.setSecret(process.env.TEST_MNEMONIC);
  await w.init(storageMock);

  w.setAccountNumber(0);
  assert.strictEqual(await w.getOffchainReceiveAddress(), 'SP2R874DNSDKVF0Z281M8H9A2CCNZ3HDH4W2DZNT6');

  w.setAccountNumber(1);
  assert.strictEqual(await w.getOffchainReceiveAddress(), 'SP1D6V3SQR6HRSBY19HVED0YQEX3QHGYT8YH60AGF');

  w.setAccountNumber(2);
  assert.strictEqual(await w.getOffchainReceiveAddress(), 'SP0C07Q6TRG3HAXJVG9GP630DPM483NZN7G94FZD');

  w.setAccountNumber(0);
  assert.strictEqual(await w.getOffchainReceiveAddress(), 'SP2R874DNSDKVF0Z281M8H9A2CCNZ3HDH4W2DZNT6');
});

describe('StacksWallet getSendQuote / executeSendQuote', () => {
  const TO_STX = 'SP1D6V3SQR6HRSBY19HVED0YQEX3QHGYT8YH60AGF';
  const SENDER_ADDRESS = 'SP2R874DNSDKVF0Z281M8H9A2CCNZ3HDH4W2DZNT6';
  const SBTC_ID = 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token::sbtc-token';
  const SIP010_CONTRACT = 'SP2R874DNSDKVF0Z281M8H9A2CCNZ3HDH4W2DZNT6';
  const SIP010_TOKEN_ID = `${SIP010_CONTRACT}.my-token::my-token`;
  const TXID = 'stxtxid0001';

  const makeTxStub = (fee: bigint) => ({ auth: { authType: AuthType.Standard, spendingCondition: { fee } } });

  const createWallet = (): StacksWallet => {
    const w = new StacksWallet();
    (w as any)._sdkWallet = {
      accounts: [{ stxPrivateKey: 'privkey' }],
    };
    vi.spyOn(w, 'getOffchainReceiveAddress').mockResolvedValue(SENDER_ADDRESS);
    (w as any)._tokenBalances = [
      { id: SBTC_ID, symbol: 'sBTC', balance: '10000' },
      { id: SIP010_TOKEN_ID, symbol: 'MYT', balance: '2000' },
    ];
    return w;
  };

  beforeEach(() => {
    // clear, not restore: keep the vi.mock('@stacks/transactions') wiring alive across tests
    vi.clearAllMocks();
  });

  it('sBTC (no tokenId): builds contract call, quote reports STX fee, execute rebuilds and broadcasts', async () => {
    const tx = makeTxStub(180n);
    makeContractCallMock.mockResolvedValue(tx);
    broadcastTransactionMock.mockResolvedValue({ txid: TXID });

    const w = createWallet();
    const quote = await w.getSendQuote({ toAddress: TO_STX, amount: '1000' });

    expect(quote.fee).toBe('180');
    expect(quote.feeTicker).toBe('STX');
    expect(quote.feeDecimals).toBe(6);
    expect(makeContractCallMock).toHaveBeenCalledOnce();
    expect(makeContractCallMock.mock.calls[0][0]).toMatchObject({ contractName: 'sbtc-token', functionName: 'transfer' });
    expect(makeSTXTokenTransferMock).not.toHaveBeenCalled();

    const txid = await w.executeSendQuote(quote);
    expect(txid).toBe(TXID);
    // rebuild-at-execute: contract call runs a second time with the same request
    expect(makeContractCallMock).toHaveBeenCalledTimes(2);
    expect(broadcastTransactionMock).toHaveBeenCalledWith({ transaction: tx });
  });

  it('STX (tokenId=STX): builds STX token transfer; rebuilds at execute', async () => {
    const tx = makeTxStub(200n);
    makeSTXTokenTransferMock.mockResolvedValue(tx);
    broadcastTransactionMock.mockResolvedValue({ txid: TXID });

    const w = createWallet();
    const quote = await w.getSendQuote({ toAddress: TO_STX, amount: '500', tokenId: 'STX', memo: 'hello' });

    expect(quote.fee).toBe('200');
    expect(makeSTXTokenTransferMock).toHaveBeenCalledOnce();
    expect(makeSTXTokenTransferMock.mock.calls[0][0]).toMatchObject({ recipient: TO_STX, amount: 500n, memo: 'hello' });
    expect(makeContractCallMock).not.toHaveBeenCalled();

    await w.executeSendQuote(quote);
    expect(makeSTXTokenTransferMock).toHaveBeenCalledTimes(2);
  });

  it('SIP-010 token: builds contract call against token contract; rebuilds at execute', async () => {
    const tx = makeTxStub(350n);
    makeContractCallMock.mockResolvedValue(tx);
    broadcastTransactionMock.mockResolvedValue({ txid: TXID });

    const w = createWallet();
    const quote = await w.getSendQuote({ toAddress: TO_STX, amount: '500', tokenId: SIP010_TOKEN_ID });

    expect(quote.fee).toBe('350');
    expect(makeContractCallMock.mock.calls[0][0]).toMatchObject({
      contractAddress: SIP010_CONTRACT,
      contractName: 'my-token',
      functionName: 'transfer',
    });

    await w.executeSendQuote(quote);
    expect(makeContractCallMock).toHaveBeenCalledTimes(2);
    // second build call uses the same request payload
    expect(makeContractCallMock.mock.calls[1][0]).toMatchObject({
      contractAddress: SIP010_CONTRACT,
      contractName: 'my-token',
      functionName: 'transfer',
    });
  });

  it('throws on insufficient sBTC balance', async () => {
    const w = createWallet();
    (w as any)._tokenBalances = [{ id: SBTC_ID, symbol: 'sBTC', balance: '100' }];
    await expect(w.getSendQuote({ toAddress: TO_STX, amount: '1000' })).rejects.toThrow(/Insufficient sBTC balance/);
  });

  it('unwraps raw string broadcast response', async () => {
    const tx = makeTxStub(180n);
    makeContractCallMock.mockResolvedValue(tx);
    broadcastTransactionMock.mockResolvedValue('rawtxid123');

    const w = createWallet();
    const quote = await w.getSendQuote({ toAddress: TO_STX, amount: '1000' });
    const txid = await w.executeSendQuote(quote);
    expect(txid).toBe('rawtxid123');
  });

  it('throws when broadcast response is unrecognized', async () => {
    const tx = makeTxStub(180n);
    makeContractCallMock.mockResolvedValue(tx);
    broadcastTransactionMock.mockResolvedValue({ error: 'nope' });

    const w = createWallet();
    const quote = await w.getSendQuote({ toAddress: TO_STX, amount: '1000' });
    await expect(w.executeSendQuote(quote)).rejects.toThrow(/Failed to broadcast transfer/);
  });

  it('throws if wallet not initialized', async () => {
    const w = new StacksWallet();
    await expect(w.getSendQuote({ toAddress: TO_STX, amount: '1000' })).rejects.toThrow(/not initialized/);
  });
});
