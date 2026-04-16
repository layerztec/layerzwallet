import { beforeEach, describe, expect, test, vi } from 'vitest';

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock('../../util/fetch', () => ({
  fetch: fetchMock,
}));

import Lnurl from '../../class/lnurl';

const WITHDRAW_LNURL = 'LNURL1DP68GURN8GHJ7UMPW33XZUM99E3K7TN6VYHHWTE5V9NRSV35V33KVDRZV43NZENXXQ6XZVPNVVERVE3EVYEXVEPNXY8FZW5Q';
const PAY_LNURL = 'LNURL1DP68GURN8GHJ7UMPW33XZUM99E3K7TN6VYHKVTE3V5EXZEF5VVCNGWPSXE3KGWPJVD3NJCFC8YMK2VFEXYURSVFSV54J6EE2';

const lnurlResponses = new Map([
  [
    Lnurl.getUrlFromLnurl(WITHDRAW_LNURL),
    {
      callback: 'https://satbase.co.za/redeem/4af824dcf4bec1ff04a03c26f9a2fd31/callback',
      defaultDescription: 'Redeem Voucher',
      k1: '46f497bff874016f60a6eb967c66724b',
      maxWithdrawable: 190000,
      minWithdrawable: 190000,
      tag: 'withdrawRequest',
    },
  ],
  [
    Lnurl.getUrlFromLnurl(PAY_LNURL),
    {
      callback: 'https://satbase.co.za/fund/1e2ae4c14806cd82cc9a897e1918810e/callback',
      maxSendable: 999800000,
      metadata: '[["text/plain","Fund a Voucher"]]',
      minSendable: 1000,
      tag: 'payRequest',
    },
  ],
]);

(globalThis as any).__DEV__ = true;

beforeEach(() => {
  fetchMock.mockImplementation(async (url: string) => {
    const payload = lnurlResponses.get(url);

    if (!payload) {
      throw new Error(`Unexpected fetch URL: ${url}`);
    }

    return {
      json: vi.fn().mockResolvedValue(payload),
      status: 200,
    };
  });
});

describe('Lnurl.isLightningAddressOrLnurl', () => {
  test('accepts raw bech32 lnurl pay requests', () => {
    expect(Lnurl.isLightningAddressOrLnurl('LNURL1DP68GURN8GHJ7MRWW4EXCTNRDA3K7MRWW4EXCU0')).toBe(true);
  });

  test('accepts lightning addresses', () => {
    expect(Lnurl.isLightningAddressOrLnurl('r1n04h@layerz.me')).toBe(true);
  });

  test('rejects bolt11 invoices', () => {
    expect(
      Lnurl.isLightningAddressOrLnurl(
        'lnbc1u1pwry044pp53xlmkghmzjzm3cljl6729cwwqz5hhnhevwfajpkln850n7clft4sdqlgfy4qv33ypmj7sj0f32rzvfqw3jhxaqcqzysxq97zvuq5zy8ge6q70prnvgwtade0g2k5h2r76ws7j2926xdjj2pjaq6q3r4awsxtm6k5prqcul73p3atveljkn6wxdkrcy69t6k5edhtc6q7lgpe4m5k4'
      )
    ).toBe(false);
  });
});

describe('Lnurl.isLnurlWithdrawRequest', () => {
  test('accepts lnurl withdraw requests', async () => {
    expect(await Lnurl.isLnurlWithdrawRequest(WITHDRAW_LNURL)).toBe(true);
  });

  test('rejects lnurl pay requests', async () => {
    expect(await Lnurl.isLnurlWithdrawRequest(PAY_LNURL)).toBe(false);
  });
});
