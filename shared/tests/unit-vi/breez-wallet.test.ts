import { Payment } from '@breeztech/breez-sdk-liquid';
import { assert, describe, it, vi } from 'vitest';
import { BreezWallet } from '../../class/wallets/breez-wallet';
import { DeepPartial } from '../../class/wallets/types';
import { NETWORK_LIQUID } from '../../types/networks';

// @ts-ignore: no need to use real breez adapter
globalThis.breezAdapter = null;

describe('Breez Wallet - getCommonTransactions', () => {
  it('should return transactions in correct order', async () => {
    const wallet = new BreezWallet('test mnemonic', 'testnet');

    const fakePayments: DeepPartial<Payment>[] = [
      // BTC
      {
        txId: '095cf834f56cc032708bb2465463ae348164b4d498b181f52fd98d0097c08629',
        timestamp: 6,
        amountSat: 1123,
        feesSat: 0,
        status: 'complete',
        details: {
          assetId: '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d',
          type: 'liquid',
          assetInfo: {
            name: 'Bitcoin',
            amount: 0.00001123,
            ticker: 'BTC',
            fees: undefined,
          },
        },
        paymentType: 'receive',
      },
      // USDT
      {
        amountSat: 0,
        details: {
          assetId: 'ce091c998b83c78bb71a632313ba3760f1763d9cfcffae02258ffa9865a37bd2',
          assetInfo: {
            amount: 0.03,
            name: 'Tether USD',
            ticker: 'USDt',
          },
          type: 'liquid',
        },
        feesSat: 81,
        paymentType: 'send',
        status: 'complete',
        timestamp: 5,
        txId: 'tx2',
      },
      // Lightning, receive
      {
        feesSat: 48,
        paymentType: 'receive',
        status: 'complete',
        details: {
          type: 'lightning',
          paymentHash: '3e28957ff7e6dc624823bbb3e9d95864075f1dcb63490f7285d593dd9868b7b9',
          swapId: 'KBnpxEfCxPSX',
          claimTxId: 'tx3',
          liquidExpirationBlockheight: 3420492,
          invoice:
            'lnbc1010n1p59znsksp5gkv0ss3kd80vhn284ev2g40zsjxj6hm7epgrzfta9prsl2yngksqpp58c5f2llhumwxyjprhwe7nk2cvsr478wtvdys7u596kfamxrgk7usdpz2pshjmt9de6zqar0ypp9gseqwaskcmr9wsxqyp2xqcqz95rzjqg2c53zuagptyaf32d9rdsww9qz8fcd4jwgneapuuuu9v3ykehcjkzzxeyqq28qqqqqqqqqqqqqqq9gq2y9qyysgqh7t4hhxlhqueaeyma0v92mz2sjypl79vg0qv2ckvy9pd6yn88qfhfz402wlw5r0gsmf0swyaep9enkzws8ns94fgwt23aqdwn9nrlgcpgn87fv',
          preimage: '2d974f6182c02c9f0f156b773bb1c228695d0b117c2499c920efc9a33b6a6ad3',
        },
        swapperFeesSat: 1,
        txId: 'tx3',
        timestamp: 4,
        amountSat: 53,
      },
      // Unknown asset, send
      {
        details: {
          type: 'liquid',
          assetId: 'ec24f3e4a4993802f901d881ea1bbfc642dfbc25d5fe82af2564ddc59dc025a9',
          description: 'Liquid transfer',
          destination:
            'liquidtestnet:tlq1qqt0ms77xycr0c40jz8rtdsp230vmx8yzczrm5d7fjm95wc89pe6667uzw86jt53684mudx3qha50qwuhyqxtsmdfpyh6pfycx?assetid=ec24f3e4a4993802f901d881ea1bbfc642dfbc25d5fe82af2564ddc59dc025a9&amount=0.00000001',
        },
        destination:
          'liquidtestnet:tlq1qqt0ms77xycr0c40jz8rtdsp230vmx8yzczrm5d7fjm95wc89pe6667uzw86jt53684mudx3qha50qwuhyqxtsmdfpyh6pfycx?assetid=ec24f3e4a4993802f901d881ea1bbfc642dfbc25d5fe82af2564ddc59dc025a9&amount=0.00000001',
        timestamp: 3,
        amountSat: 1,
        feesSat: 40,
        paymentType: 'send',
        status: 'complete',
        txId: '1d9939da15721adbd021d550286fec9f8476c0218073416966e62ef8f4de1f9b',
        unblindingData:
          '94,ec24f3e4a4993802f901d881ea1bbfc642dfbc25d5fe82af2564ddc59dc025a9,e8b2ddfc070e0048d2275e3e05545f50a83141472197b6f0f78bad71e2a61606,d18841bb2cda97d31ecc37b563d623f5aa03d37c9d82954cdff30af83579c7c3,298529,144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49,2ab52dc6784b10519928593b94eeee2e06358d45fc26fbc48e6364734420f651,65dbb7f3a40a660a0c7ee9d5a6e684675dbeb048bf48e7196d2df021e3d72e3b,93,ec24f3e4a4993802f901d881ea1bbfc642dfbc25d5fe82af2564ddc59dc025a9,fc39a189b9fbc47bb25e5c27d7e1099e9bab7400aaa8a19e26a5860d45dee11f,6cd220bb2ff7c49faa7f8fc43084c8480666e898e02cf1b495b721bfe624bb71,298489,144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49,20736870a559409d312d463643b82a38ffb7c607cb50366ff4469e3843970718,58f7a90773245a2a79d71b1cdc804280baa08a5e3ca9fb97629f27a46d9c43cc',
      },

      // Liquid as a destination, receive
      {
        feesSat: 0,
        paymentType: 'receive',
        timestamp: 2,
        details: {
          description: 'Liquid transfer',
          destination: 'lq1qqfy8jhv9px5q0v5v0e2m5jltjhj2wjnq5sdf08r0fgldheas52arv56pptlw85vfmgn4vceuatwce0d4tp2xzqhhdjc89acf6',
          type: 'liquid',
          assetId: 'ce091c998b83c78bb71a632313ba3760f1763d9cfcffae02258ffa9865a37bd2',
          assetInfo: {
            ticker: 'USDt',
            amount: 1,
            name: 'Tether USD',
          },
        },
        txId: '0031ab92399f87c15cdfe75a8be905263412b9fcce8060669dc41b1e31e87cf3',
        status: 'complete',
        amountSat: 0,
        unblindingData:
          '100000000,ce091c998b83c78bb71a632313ba3760f1763d9cfcffae02258ffa9865a37bd2,c23f8896d2f9b8668b72a3429840801d284e0c95901fa16c560b63bc99d85828,ff065f5101d6ada4772867a1c2b3ae6286fc09713110b23662848bd03605b6c1',
        destination: 'lq1qqfy8jhv9px5q0v5v0e2m5jltjhj2wjnq5sdf08r0fgldheas52arv56pptlw85vfmgn4vceuatwce0d4tp2xzqhhdjc89acf6',
      },
      // Lightning as a destination, receive
      {
        timestamp: 1,
        status: 'complete',
        paymentType: 'receive',
        amountSat: 1183,
        details: {
          swapId: '4Hz5YXxQUvYc',
          preimage: '381adc96015fc3894a79ffa4efead2cc7990f117ecf74a9886f6e7f013a5cd36',
          type: 'lightning',
          liquidExpirationBlockheight: 3369124,
          paymentHash: '6c7a29a170d322261c49314d551c3a9c8a63138e8a52ea66878a9aaf21e9a8a5',
          description: 'Payment to BZ wallet',
          destinationPubkey: '02d96eadea3d780104449aca5c93461ce67c1564e2e1d73225fa67dd3b997a6018',
          invoice:
            'lnbc12340n1p5puzfasp55h6susfzhhy5acxh0jhasywghuh2ndd54jqdlrywugj4jrf7g4cspp5d3azngts6v3zv8zfx9x428p6nj9xxyuw3ffw5e5832d27g0f4zjsdpq2pshjmt9de6zqar0ypp95grhv9kxcet5xqyp2xqcqz95rzjq2h65qettudjx9wacaec92scgjjz07q5fkut3tejqvla85u052vw5zzxeyqq28qqqqqqqqqqqqqqq9gq2y9qyysgq8zhda3tyt4j5ga7n37q5j9az24k5vactakcstxzzlwr5zl7fehxpy4ukgrdaxyphafnzh6gm3x6wkvwgqew854s50e5v86g49u7wpkgq2d2vzm',
          claimTxId: '7968249135073947e2f396b5cf0ad02ca9c22435063dff895bc80faf0ec6e5f4',
        },
        unblindingData:
          '1183,6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d,65d900602d1c8178dae9a1f25c9105b38beb185208c3a6ad94c2c91fd14265b8,53973c669aea02cdcd1ed87e0266bc80b167d4e2b86bcb109f4ac979a036c126',
        txId: '7968249135073947e2f396b5cf0ad02ca9c22435063dff895bc80faf0ec6e5f4',
        feesSat: 51,
        swapperFeesSat: 4,
        destination:
          'lnbc12340n1p5puzfasp55h6susfzhhy5acxh0jhasywghuh2ndd54jqdlrywugj4jrf7g4cspp5d3azngts6v3zv8zfx9x428p6nj9xxyuw3ffw5e5832d27g0f4zjsdpq2pshjmt9de6zqar0ypp95grhv9kxcet5xqyp2xqcqz95rzjq2h65qettudjx9wacaec92scgjjz07q5fkut3tejqvla85u052vw5zzxeyqq28qqqqqqqqqqqqqqq9gq2y9qyysgq8zhda3tyt4j5ga7n37q5j9az24k5vactakcstxzzlwr5zl7fehxpy4ukgrdaxyphafnzh6gm3x6wkvwgqew854s50e5v86g49u7wpkgq2d2vzm',
      },
    ];

    vi.spyOn(wallet, 'listPayments').mockResolvedValue(fakePayments as Payment[]);

    const result1 = await wallet.getCommonTransactions();

    assert.deepEqual(result1, [
      {
        txid: '095cf834f56cc032708bb2465463ae348164b4d498b181f52fd98d0097c08629',
        network: NETWORK_LIQUID,
        timestamp: 6,
        direction: 'receive',
        status: 'confirmed',
        fee: 0,
        amount: 1123,
        explorerUrl: 'https://liquid.network/testnet/tx/095cf834f56cc032708bb2465463ae348164b4d498b181f52fd98d0097c08629',
      },
      {
        txid: 'tx2',
        network: NETWORK_LIQUID,
        timestamp: 5,
        direction: 'send',
        status: 'confirmed',
        fee: 81,
        amount: undefined,
        tokenTransfers: [
          {
            address: undefined,
            amount: 3000000,
            tokenId: 'ce091c998b83c78bb71a632313ba3760f1763d9cfcffae02258ffa9865a37bd2',
          },
        ],
        explorerUrl: 'https://liquid.network/testnet/tx/tx2',
      },
      {
        amount: 53,
        direction: 'receive',
        fee: 48,
        network: NETWORK_LIQUID,
        status: 'confirmed',
        timestamp: 4,
        txid: 'tx3',
        explorerUrl: 'https://liquid.network/testnet/tx/tx3',
      },
      {
        amount: undefined,
        direction: 'receive',
        fee: 0,
        network: 'liquid',
        status: 'confirmed',
        timestamp: 2,
        tokenTransfers: [
          {
            address: 'lq1qqfy8jhv9px5q0v5v0e2m5jltjhj2wjnq5sdf08r0fgldheas52arv56pptlw85vfmgn4vceuatwce0d4tp2xzqhhdjc89acf6',
            amount: 100000000,
            tokenId: 'ce091c998b83c78bb71a632313ba3760f1763d9cfcffae02258ffa9865a37bd2',
          },
        ],
        txid: '0031ab92399f87c15cdfe75a8be905263412b9fcce8060669dc41b1e31e87cf3',
        explorerUrl: 'https://liquid.network/testnet/tx/0031ab92399f87c15cdfe75a8be905263412b9fcce8060669dc41b1e31e87cf3',
      },
      {
        amount: 1183,
        direction: 'receive',
        fee: 51,
        network: 'liquid',
        status: 'confirmed',
        timestamp: 1,
        txid: '7968249135073947e2f396b5cf0ad02ca9c22435063dff895bc80faf0ec6e5f4',
        explorerUrl: 'https://liquid.network/testnet/tx/7968249135073947e2f396b5cf0ad02ca9c22435063dff895bc80faf0ec6e5f4',
      },
    ]);
  });
});
