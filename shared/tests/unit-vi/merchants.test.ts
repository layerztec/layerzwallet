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
  ])('$description', ({ qrContent, network, expected }) => {
    const result = convertMerchantQRToLightningAddress({ qrContent, network });
    expect(result).toBe(expected);
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
