import { describe, expect, test, vi } from 'vitest';
import { parseQrIntent, handleQrIntent } from '../../modules/scan-routing';
import { NETWORK_LIGHTNING } from '@shared/types/networks';

describe('scan-routing parser', () => {
  test('parses lightning lnurl payloads', () => {
    const raw = 'lightning:LNURL1DP68GURN8GHJ7MRWW4EXCTNRDA3K7MRWW4EXCU0';
    const intent = parseQrIntent(raw);

    expect(intent.type).toBe('lightning');
    expect(intent).toMatchObject({ invoice: 'LNURL1DP68GURN8GHJ7MRWW4EXCTNRDA3K7MRWW4EXCU0' });
  });

  test('parses lightning bolt11 payloads', () => {
    const raw =
      'lightning:lnbc4u1p5z7y4cpp5vzjkl2svmtyt2d8q9f5clsch5ppemt8320spdj24kve45gq9uvesdqqcqzysxqyz5vqsp5rfv2fel3smq2sxerf664w0mmtnexl6yweenf0dftpujhftcvfayq9qxpqysgqkzlnzf7nrv3qhduf9dkrcc599d04674afkgfewkxtk060h8d92v8zzlwpg3yc7utfkzezvp2geld00fe4ggrmvp6klltkzvkxfal7qcq79eqvg';
    const intent = parseQrIntent(raw);

    expect(intent.type).toBe('lightning');
    expect(intent).toMatchObject({
      invoice:
        'lnbc4u1p5z7y4cpp5vzjkl2svmtyt2d8q9f5clsch5ppemt8320spdj24kve45gq9uvesdqqcqzysxqyz5vqsp5rfv2fel3smq2sxerf664w0mmtnexl6yweenf0dftpujhftcvfayq9qxpqysgqkzlnzf7nrv3qhduf9dkrcc599d04674afkgfewkxtk060h8d92v8zzlwpg3yc7utfkzezvp2geld00fe4ggrmvp6klltkzvkxfal7qcq79eqvg',
    });
  });

  test('parses lightning bolt11 payloads w/o prefix', () => {
    const raw =
      'lnbc4u1p5z7y4cpp5vzjkl2svmtyt2d8q9f5clsch5ppemt8320spdj24kve45gq9uvesdqqcqzysxqyz5vqsp5rfv2fel3smq2sxerf664w0mmtnexl6yweenf0dftpujhftcvfayq9qxpqysgqkzlnzf7nrv3qhduf9dkrcc599d04674afkgfewkxtk060h8d92v8zzlwpg3yc7utfkzezvp2geld00fe4ggrmvp6klltkzvkxfal7qcq79eqvg';
    const intent = parseQrIntent(raw);

    expect(intent.type).toBe('lightning');
    expect(intent).toMatchObject({
      invoice:
        'lnbc4u1p5z7y4cpp5vzjkl2svmtyt2d8q9f5clsch5ppemt8320spdj24kve45gq9uvesdqqcqzysxqyz5vqsp5rfv2fel3smq2sxerf664w0mmtnexl6yweenf0dftpujhftcvfayq9qxpqysgqkzlnzf7nrv3qhduf9dkrcc599d04674afkgfewkxtk060h8d92v8zzlwpg3yc7utfkzezvp2geld00fe4ggrmvp6klltkzvkxfal7qcq79eqvg',
    });
  });

  test('parses bitcoin bip21 payloads', () => {
    const intent = parseQrIntent('bitcoin:bc1qt4t9xl2gmjvxgmp5gev6m8e6s9c85979ta7jeh?amount=0.001');

    expect(intent.type).toBe('bitcoin');
    expect(intent).toMatchObject({ address: 'bc1qt4t9xl2gmjvxgmp5gev6m8e6s9c85979ta7jeh', amount: '0.001' });
  });

  test('parses bitcoin bip21 payloads w/o prefix', () => {
    const intent = parseQrIntent('bc1qt4t9xl2gmjvxgmp5gev6m8e6s9c85979ta7jeh?amount=0.001');

    expect(intent.type).toBe('bitcoin');
    expect(intent).toMatchObject({ address: 'bc1qt4t9xl2gmjvxgmp5gev6m8e6s9c85979ta7jeh', amount: '0.001' });
  });

  test('parses bitcoin payloads w/o prefix', () => {
    const intent = parseQrIntent('bc1qt4t9xl2gmjvxgmp5gev6m8e6s9c85979ta7jeh');

    expect(intent.type).toBe('bitcoin');
    expect(intent).toMatchObject({ address: 'bc1qt4t9xl2gmjvxgmp5gev6m8e6s9c85979ta7jeh' });
  });

  test('parses malformed payloads ', () => {
    const intent = parseQrIntent('malformed');

    expect(intent.type).toBe('unknown');
    expect(intent).toStrictEqual({ raw: 'malformed', type: 'unknown' });
  });

  test('parses lightning address', () => {
    const intent = parseQrIntent('r1n04h@layerz.me');

    expect(intent.type).toBe('lightning');
    expect(intent).toMatchObject({ invoice: 'r1n04h@layerz.me' });
  });

  test('prefer lightning when several schemes are present', () => {
    const intent = parseQrIntent(
      'bitcoin:1DamianM2k8WfNEeJmyqSe2YW1upB7UATx?amount=0.000001&lightning=lnbc1u1pwry044pp53xlmkghmzjzm3cljl6729cwwqz5hhnhevwfajpkln850n7clft4sdqlgfy4qv33ypmj7sj0f32rzvfqw3jhxaqcqzysxq97zvuq5zy8ge6q70prnvgwtade0g2k5h2r76ws7j2926xdjj2pjaq6q3r4awsxtm6k5prqcul73p3atveljkn6wxdkrcy69t6k5edhtc6q7lgpe4m5k4'
    );

    expect(intent.type).toBe('lightning');
    expect(intent).toMatchObject({
      invoice:
        'lnbc1u1pwry044pp53xlmkghmzjzm3cljl6729cwwqz5hhnhevwfajpkln850n7clft4sdqlgfy4qv33ypmj7sj0f32rzvfqw3jhxaqcqzysxq97zvuq5zy8ge6q70prnvgwtade0g2k5h2r76ws7j2926xdjj2pjaq6q3r4awsxtm6k5prqcul73p3atveljkn6wxdkrcy69t6k5edhtc6q7lgpe4m5k4',
    });
  });

  test('parses merchant QR code', () => {
    const intent = parseQrIntent('00020126260008za.co.mp0110248723666427530023za.co.electrum.picknpay0122ydgKJviKSomaVw0297RaZw5303710540571.406304CE9C');

    expect(intent.type).toBe('posMerchant');
    expect(intent).toMatchObject({
      raw: '00020126260008za.co.mp0110248723666427530023za.co.electrum.picknpay0122ydgKJviKSomaVw0297RaZw5303710540571.406304CE9C',
    });
  });

  test('parses merchant QR code 2', () => {
    const intent = parseQrIntent('https://app.scantopay.io/qr?qrcode=8962148867');

    expect(intent.type).toBe('posMerchant');
    expect(intent).toMatchObject({
      raw: 'https://app.scantopay.io/qr?qrcode=8962148867',
    });
  });

  test('parses merchant QR code 2', () => {
    const intent = parseQrIntent('0337704903');

    expect(intent.type).toBe('posMerchant');
    expect(intent).toMatchObject({
      raw: '0337704903',
    });
  });
});

describe('scan-routing handler', () => {
  test('routes lightning payloads to SendLightning', async () => {
    const push = vi.fn();
    const router = { push };
    const invoice = 'lightning:lnurl1dp68gurn8ghj7mrww4exctnrda3k7mrww4excu0';

    const handled = await handleQrIntent(invoice, router);

    expect(handled).toBe(true);
    expect(push).toHaveBeenCalledWith({ pathname: '/send', params: { network: NETWORK_LIGHTNING, address: 'lnurl1dp68gurn8ghj7mrww4exctnrda3k7mrww4excu0' } });
  });

  test('routes merchant QR code payloads to SendLightning', async () => {
    const push = vi.fn();
    const router = { push };
    const invoice = '00020129530023za.co.electrum.picknpay0122D57H4TMHFZ2TEZ/confirm520458125303710540115802ZA5916cryptoqrtestscan6002CT6304A440';

    const handled = await handleQrIntent(invoice, router);

    expect(handled).toBe(true);
    expect(push).toHaveBeenCalledWith({
      pathname: '/PosMerchant',
      params: { raw: invoice },
    });
  });

  test('routes bitcoin payloads to send', async () => {
    const push = vi.fn();
    const router = { push };
    const handled = await handleQrIntent('bitcoin:bc1qt4t9xl2gmjvxgmp5gev6m8e6s9c85979ta7jeh?amount=0.25', router);

    expect(handled).toBe(true);
    expect(push).toHaveBeenCalledWith({ pathname: '/send', params: { address: 'bc1qt4t9xl2gmjvxgmp5gev6m8e6s9c85979ta7jeh', amount: '0.25' } });
  });

  test('routes bitcoin payloads to send 2', async () => {
    const push = vi.fn();
    const router = { push };
    const handled = await handleQrIntent('bitcoin:1DzJepHCRD2C9vpFjk11eXJi97juEZ3ftv?amount=0.004&message=wheres the money lebowski', router);

    expect(handled).toBe(true);
    expect(push).toHaveBeenCalledWith({ pathname: '/send', params: { address: '1DzJepHCRD2C9vpFjk11eXJi97juEZ3ftv', amount: '0.004' } });
  });

  test('returns false for malformed/unknown payloads', async () => {
    const push = vi.fn();
    const router = { push };
    const handled = await handleQrIntent('invalid-qr-code-data', router);

    expect(push).not.toHaveBeenCalled();
    expect(handled).toBe(false);
  });
});
