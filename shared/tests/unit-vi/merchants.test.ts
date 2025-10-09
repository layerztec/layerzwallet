/**
 *
 * https://github.com/GaloyMoney/galoy-client/blob/main/src/parsing/merchants.spec.ts
 */
import { describe, test, expect } from 'vitest';
import { convertMerchantQRToLightningAddress } from '../../modules/merchants';
export type Network = 'mainnet' | 'signet' | 'regtest';

describe('convertMerchantQRToLightningAddress', () => {
  // Test cases for valid QR contents and networks
  test.each([
    {
      description: 'PicknPay EMV QR code on mainnet',
      qrContent: '00020126260008za.co.mp0110248723666427530023za.co.electrum.picknpay0122ydgKJviKSomaVw0297RaZw5303710540571.406304CE9C',
      network: 'mainnet' as Network,
      expected: '00020126260008za.co.mp0110248723666427530023za.co.electrum.picknpay0122ydgKJviKSomaVw0297RaZw5303710540571.406304CE9C@cryptoqr.net',
    },
    {
      description: 'PicknPay EMV QR code on signet',
      qrContent: '00020126260008za.co.mp0110628654976427530023za.co.electrum.picknpay0122a/r4RBWjSNGflZtjFg4VJQ530371054041.2363044A53',
      network: 'signet' as Network,
      expected: '00020126260008za.co.mp0110628654976427530023za.co.electrum.picknpay0122a%2Fr4RBWjSNGflZtjFg4VJQ530371054041.2363044A53@staging.cryptoqr.net',
    },
    {
      description: 'Ecentric EMV QR code on mainnet',
      qrContent: '00020129530019za.co.ecentric.payment0122RD2HAK3KTI53EC/confirm520458125303710540115802ZA5916cryptoqrtestscan6002CT63049BE2',
      network: 'mainnet' as Network,
      expected: '00020129530019za.co.ecentric.payment0122RD2HAK3KTI53EC%2Fconfirm520458125303710540115802ZA5916cryptoqrtestscan6002CT63049BE2@cryptoqr.net',
    },
    {
      description: 'PicknPay QR code with uppercase content',
      qrContent: '00020129530023ZA.CO.ELECTRUM.PICKNPAY0122RD2HAK3KTI53EC/CONFIRM520458125303710540115802ZA5916CRYPTOQRTESTSCAN6002CT63049BE2',
      network: 'mainnet' as Network,
      expected: '00020129530023ZA.CO.ELECTRUM.PICKNPAY0122RD2HAK3KTI53EC%2FCONFIRM520458125303710540115802ZA5916CRYPTOQRTESTSCAN6002CT63049BE2@cryptoqr.net',
    },
    {
      description: 'Ecentric QR code with mixed case',
      qrContent: '00020129530019Za.Co.EcEnTrIc.payment0122RD2HAK3KTI53EC/confirm520458125303710540115802ZA5916cryptoqrtestscan6002CT63049BE2',
      network: 'mainnet' as Network,
      expected: '00020129530019Za.Co.EcEnTrIc.payment0122RD2HAK3KTI53EC%2Fconfirm520458125303710540115802ZA5916cryptoqrtestscan6002CT63049BE2@cryptoqr.net',
    },
    {
      description: 'PicknPay QR code with Unicode characters',
      qrContent: '00020129530023za.co.electrum.picknpay0122RD2HAK3KTI53EC/confirm★測試520458125303710540115802ZA5916cryptoqrtestscan6002CT63049BE2',
      network: 'mainnet' as Network,
      expected: '00020129530023za.co.electrum.picknpay0122RD2HAK3KTI53EC%2Fconfirm%E2%98%85%E6%B8%AC%E8%A9%A6520458125303710540115802ZA5916cryptoqrtestscan6002CT63049BE2@cryptoqr.net',
    },
    {
      description: 'Ecentric QR code with emoji',
      qrContent: '00020129530019za.co.ecentric.payment0122RD2HAK3KTI53EC/confirm🎉test520458125303710540115802ZA5916cryptoqrtestscan6002CT63049BE2',
      network: 'mainnet' as Network,
      expected: '00020129530019za.co.ecentric.payment0122RD2HAK3KTI53EC%2Fconfirm%F0%9F%8E%89test520458125303710540115802ZA5916cryptoqrtestscan6002CT63049BE2@cryptoqr.net',
    },
    /////////////////
    {
      description: 'PnP',
      qrContent: '00020126260008za.co.mp0110990417643427530023za.co.electrum.picknpay0122/LBatCP+Q/qjr3eBlnqHbA53037105406211.106304F1A7',
      network: 'mainnet' as Network,
      expected: '00020126260008za.co.mp0110990417643427530023za.co.electrum.picknpay0122%2FLBatCP%2BQ%2Fqjr3eBlnqHbA53037105406211.106304F1A7@cryptoqr.net',
    },
    {
      description: 'Yoyo',
      qrContent: 'https://rad2.wigroup.co/bill/125468',
      network: 'mainnet' as Network,
      expected: 'https%3A%2F%2Frad2.wigroup.co%2Fbill%2F125468@cryptoqr.net',
    },
    {
      description: 'Yoyo2',
      qrContent: 'https://rad2.yoyogroup.co/bill/125468',
      network: 'mainnet' as Network,
      expected: 'https%3A%2F%2Frad2.yoyogroup.co%2Fbill%2F125468@cryptoqr.net',
    },
    {
      description: 'Zapper',
      qrContent: 'http://2.zap.pe?t=6&i=40895:49955:7[34|29.99|11,33n|REF12345|10:10[39|ZAR,38|DillonDev',
      network: 'mainnet' as Network,
      expected: 'http%3A%2F%2F2.zap.pe%3Ft%3D6%26i%3D40895%3A49955%3A7%5B34%7C29.99%7C11%2C33n%7CREF12345%7C10%3A10%5B39%7CZAR%2C38%7CDillonDev@cryptoqr.net',
    },
    {
      description: 'scantopay',
      qrContent: 'https%3A%2F%2Fapp.scantopay.io%2Fqr%3Fqrcode%3D8784599487',
      network: 'mainnet' as Network,
      expected: 'https%253A%252F%252Fapp.scantopay.io%252Fqr%253Fqrcode%253D8784599487@cryptoqr.net',
    },
    {
      description: 'scantopay2',
      qrContent: 'https://app.scantopay.io/qr?qrcode=8962148867',
      network: 'mainnet' as Network,
      expected: 'https%3A%2F%2Fapp.scantopay.io%2Fqr%3Fqrcode%3D8962148867@cryptoqr.net',
    },
    {
      description: 'scantopay3',
      qrContent: '0337704903',
      network: 'mainnet' as Network,
      expected: '0337704903@cryptoqr.net',
    },
    {
      description: 'Checkers/Shoprite',
      qrContent: '00020126260008za.co.mp0110847268562627440014za.co.electrum0122+r3YIUYPRcuRzFeKDYRAvA',
      network: 'mainnet' as Network,
      expected: '00020126260008za.co.mp0110847268562627440014za.co.electrum0122%2Br3YIUYPRcuRzFeKDYRAvA@cryptoqr.net',
    },
    {
      description: 'Snapscan',
      qrContent: 'https://pos-staging.snapscan.io/qr/N0utvgph',
      network: 'mainnet' as Network,
      expected: 'https%3A%2F%2Fpos-staging.snapscan.io%2Fqr%2FN0utvgph@cryptoqr.net',
    },
    {
      description: 'Ecentric',
      qrContent:
        '00020101021233300014za.co.ecentric0108Test12345204123453037105403,455802ZA5920Woolworths Cavendish6010Rondebosch6270011200000000007503150060012005000010708500010000807Payment88081045111591360032C62946E8F0AF4E12B1D7B4E3D4C109F0630486F7',
      network: 'mainnet' as Network,
      expected:
        '00020101021233300014za.co.ecentric0108Test12345204123453037105403%2C455802ZA5920Woolworths%20Cavendish6010Rondebosch6270011200000000007503150060012005000010708500010000807Payment88081045111591360032C62946E8F0AF4E12B1D7B4E3D4C109F0630486F7@cryptoqr.net',
    },
    {
      description: 'Moneybadger',
      qrContent: 'https://pay.cryptoqr.net/3458967',
      network: 'mainnet' as Network,
      expected: 'https%3A%2F%2Fpay.cryptoqr.net%2F3458967@cryptoqr.net',
    },
    {
      description: 'from demo',
      qrContent: '00020129530023za.co.electrum.picknpay0122D57H4TMHFZ2TEZ/confirm520458125303710540115802ZA5916cryptoqrtestscan6002CT6304A440',
      network: 'mainnet' as Network,
      expected: '00020129530023za.co.electrum.picknpay0122D57H4TMHFZ2TEZ%2Fconfirm520458125303710540115802ZA5916cryptoqrtestscan6002CT6304A440@cryptoqr.net',
    },
  ])('$description', ({ qrContent, network, expected }) => {
    const result = convertMerchantQRToLightningAddress({ qrContent, network });
    expect(result).toBe(expected);

    // must not return the same result for already parsed result
    const negativeResult = convertMerchantQRToLightningAddress({ qrContent: expected, network });
    expect(negativeResult).toBe(null);
  });

  // Test cases for invalid QR contents
  test.each([
    {
      description: 'non-matching merchant in EMV format',
      qrContent: '00020129530023other.merchant.code0122RD2HAK3KTI53EC/confirm520458125303710540115802ZA5916cryptoqrtestscan6002CT63049BE2',
      network: 'mainnet' as Network,
    },
    {
      description: 'empty QR content',
      qrContent: '',
      network: 'mainnet' as Network,
    },
    {
      description: 'malformed EMV QR format',
      qrContent: '000201za.co.picknpay',
      network: 'mainnet' as Network,
    },
    {
      description: 'invalid merchant identifier',
      qrContent: 'Nakamoto+btc',
      network: 'mainnet' as Network,
    },
    {
      description: 'invalid merchant identifier in EMV format',
      qrContent: '00020129530023za.co.unknown.merchant0122RD2HAK3KTI53EC/confirm520458125303710540115802ZA5916cryptoqrtestscan6002CT63049BE2',
      network: 'mainnet' as Network,
    },
    {
      description: 'regular ln address',
      qrContent: 'r1n04h@layerz.me',
      network: 'mainnet' as Network,
    },
  ])('returns null for $description', ({ qrContent, network }) => {
    const result = convertMerchantQRToLightningAddress({ qrContent, network });
    expect(result).toBeNull();
  });

  // Edge cases and special scenarios
  test('handles multiple merchant identifiers in the same QR content', () => {
    const qrContent = '00020129530023za.co.electrum.picknpay.za.co.ecentric0122RD2HAK3KTI53EC/confirm520458125303710540115802ZA5916cryptoqrtestscan6002CT63049BE2';
    const result = convertMerchantQRToLightningAddress({
      qrContent,
      network: 'mainnet',
    });
    expect(result).toBe('00020129530023za.co.electrum.picknpay.za.co.ecentric0122RD2HAK3KTI53EC%2Fconfirm520458125303710540115802ZA5916cryptoqrtestscan6002CT63049BE2@cryptoqr.net');
  });

  test('handles URL-unsafe characters in EMV format', () => {
    const qrContent = '00020129530023za.co.electrum.picknpay0122RD2HAK3KTI53EC?param=value&other=123520458125303710540115802ZA5916cryptoqrtestscan6002CT63049BE2';
    const result = convertMerchantQRToLightningAddress({
      qrContent,
      network: 'mainnet',
    });
    expect(result).toBe('00020129530023za.co.electrum.picknpay0122RD2HAK3KTI53EC%3Fparam%3Dvalue%26other%3D123520458125303710540115802ZA5916cryptoqrtestscan6002CT63049BE2@cryptoqr.net');
  });

  test('preserves original case in EMV format', () => {
    const qrContent = '00020129530023ZA.co.ELECTRUM.picknpay0122RD2HAK3KTI53EC/confirm520458125303710540115802ZA5916cryptoqrtestscan6002CT63049BE2';
    const result = convertMerchantQRToLightningAddress({
      qrContent,
      network: 'mainnet',
    });
    expect(result).toBe('00020129530023ZA.co.ELECTRUM.picknpay0122RD2HAK3KTI53EC%2Fconfirm520458125303710540115802ZA5916cryptoqrtestscan6002CT63049BE2@cryptoqr.net');
  });
});
