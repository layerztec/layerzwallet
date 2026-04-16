import { describe, expect, test } from 'vitest';

import Lnurl from '../../class/lnurl';

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
