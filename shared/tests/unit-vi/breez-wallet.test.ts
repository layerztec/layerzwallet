import { describe, it, vi, assert } from 'vitest';
import { BreezWallet } from '../../class/wallets/breez-wallet';
import { NETWORK_LIQUID } from '../../types/networks';
import { Payment } from '@breeztech/breez-sdk-liquid';

// @ts-ignore: no need to use real breez adapter
globalThis.breezAdapter = null;

describe('Breez Wallet - getCommonTransactions', () => {
  it('should return transactions in correct order', async () => {
    const wallet = new BreezWallet('test mnemonic', 'mainnet');

    const fakePayments = [
      // BTC
      {
        txId: '095cf834f56cc032708bb2465463ae348164b4d498b181f52fd98d0097c08629',
        timestamp: 1754383510,
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
        timestamp: 1754384530,
        txId: 'tx2',
      },
      // Lightning
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
        timestamp: 1750158910,
        amountSat: 53,
      },
      // Unknown asset
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
        timestamp: 1749209827,
        amountSat: 1,
        feesSat: 40,
        paymentType: 'send',
        status: 'complete',
        txId: '1d9939da15721adbd021d550286fec9f8476c0218073416966e62ef8f4de1f9b',
        unblindingData:
          '94,ec24f3e4a4993802f901d881ea1bbfc642dfbc25d5fe82af2564ddc59dc025a9,e8b2ddfc070e0048d2275e3e05545f50a83141472197b6f0f78bad71e2a61606,d18841bb2cda97d31ecc37b563d623f5aa03d37c9d82954cdff30af83579c7c3,298529,144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49,2ab52dc6784b10519928593b94eeee2e06358d45fc26fbc48e6364734420f651,65dbb7f3a40a660a0c7ee9d5a6e684675dbeb048bf48e7196d2df021e3d72e3b,93,ec24f3e4a4993802f901d881ea1bbfc642dfbc25d5fe82af2564ddc59dc025a9,fc39a189b9fbc47bb25e5c27d7e1099e9bab7400aaa8a19e26a5860d45dee11f,6cd220bb2ff7c49faa7f8fc43084c8480666e898e02cf1b495b721bfe624bb71,298489,144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49,20736870a559409d312d463643b82a38ffb7c607cb50366ff4469e3843970718,58f7a90773245a2a79d71b1cdc804280baa08a5e3ca9fb97629f27a46d9c43cc',
      },
    ] as Payment[];

    vi.spyOn(wallet, 'listPayments').mockResolvedValue(fakePayments);

    const result1 = await wallet.getCommonTransactions();

    assert.deepEqual(result1, [
      {
        txid: '095cf834f56cc032708bb2465463ae348164b4d498b181f52fd98d0097c08629',
        network: NETWORK_LIQUID,
        timestamp: 1754383510,
        direction: 'receive',
        status: 'confirmed',
        fee: 0,
        amount: 1123,
        tokenTransfers: [],
      },
      {
        txid: 'tx2',
        network: NETWORK_LIQUID,
        timestamp: 1754384530,
        direction: 'send',
        status: 'confirmed',
        fee: 81,
        amount: 0,
        tokenTransfers: [
          {
            address: 'ce091c998b83c78bb71a632313ba3760f1763d9cfcffae02258ffa9865a37bd2',
            amount: 0.03,
          },
        ],
      },
      {
        amount: 53,
        direction: 'receive',
        fee: 48,
        network: NETWORK_LIQUID,
        status: 'confirmed',
        timestamp: 1750158910,
        tokenTransfers: [],
        txid: 'tx3',
      },
      {
        amount: 1,
        direction: 'send',
        fee: 40,
        network: 'liquid',
        status: 'confirmed',
        timestamp: 1749209827,
        tokenTransfers: [
          {
            address: 'ec24f3e4a4993802f901d881ea1bbfc642dfbc25d5fe82af2564ddc59dc025a9',
            amount: 1e-8,
          },
        ],
        txid: '1d9939da15721adbd021d550286fec9f8476c0218073416966e62ef8f4de1f9b',
      },
    ]);
  });
});
