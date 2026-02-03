import { describe, expect, it, beforeAll, assert } from 'vitest';
import { RGBWallet } from '@shared/class/wallets/rgb-wallet';
import { NETWORK_RGB_TESTNET } from '@shared/types/networks';

const TIMEOUT = 60000;

describe('RGB Integration', () => {
  let wallet: RGBWallet;

  describe('rgbAdapter', () => {
    it('should initialize and return SDK', async () => {
      const sdk = await globalThis.rgbAdapter.initialize();
      expect(sdk).toBeDefined();
      expect(sdk.createWallet).toBeDefined();
    });

    it('should return cached SDK on subsequent calls', async () => {
      const sdk1 = await globalThis.rgbAdapter.initialize();
      const sdk2 = await globalThis.rgbAdapter.initialize();
      expect(sdk1).toBe(sdk2);
    });
  });

  beforeAll(async () => {
    assert(process.env.TEST_MNEMONIC, 'TEST_MNEMONIC not set');
    wallet = new RGBWallet('testnet');
    wallet.setSecret(process.env.TEST_MNEMONIC);
    await wallet.init();
  }, TIMEOUT);

  it(
    'should get balance',
    async () => {
      const balance = await wallet.getBalance();
      expect(typeof balance).toBe('number');
    },
    TIMEOUT
  );

  it(
    'should get common transactions',
    async () => {
      const transactions = await wallet.getCommonTransactions();

      expect(Array.isArray(transactions)).toBe(true);

      for (const tx of transactions) {
        expect(tx.network).toBe(NETWORK_RGB_TESTNET);
        expect(tx.txid).toBeDefined();
        expect(typeof tx.timestamp).toBe('number');
        expect(['pending', 'confirmed', 'failed', 'cancelled']).toContain(tx.status);
        expect(['send', 'receive', 'swap', 'other']).toContain(tx.direction);

        // Verify token transfers have embedded token info
        if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
          for (const transfer of tx.tokenTransfers) {
            expect(transfer.name).toBeDefined();
            expect(transfer.symbol).toBeDefined();
            expect(transfer.decimals).toBeDefined();
            expect(typeof transfer.amount).toBe('number');
          }
        }
      }

      // Verify sorted by timestamp (newest first)
      for (let i = 1; i < transactions.length; i++) {
        expect(transactions[i - 1].timestamp).toBeGreaterThanOrEqual(transactions[i].timestamp);
      }
    },
    TIMEOUT
  );

  it(
    'should fetch token balances',
    async () => {
      await wallet.fetchTokenBalances();
      const tokens = wallet.getTokenBalances();

      expect(Array.isArray(tokens)).toBe(true);
      for (const token of tokens) {
        expect(token.id).toBeDefined();
        expect(token.name).toBeDefined();
        expect(typeof token.decimals).toBe('number');
      }
    },
    TIMEOUT
  );

  it.only('should get balance', async () => {
    const balance = await wallet.getBalance();
    assert(wallet._wallet, 'RGBWallet not initialized. Call init() first.');
    // console.log('balance', await wallet._wallet.syncWallet());
    // console.log('balance', await wallet._wallet.refreshWallet());
    console.log('balance', await wallet._wallet.getBtcBalance());
    console.log('listTransactions', await wallet._wallet.listTransactions());

    console.log('address', await wallet._wallet.getAddress());
    console.log('listAssets', await wallet._wallet.listAssets());
    const assets = await wallet._wallet.listAssets();
    const asset1 = assets.nia?.[0]?.asset_id;
    if (asset1) {
      console.log('listTransactions', await wallet._wallet.listTransfers(asset1));
    }
    console.log('listAssets', JSON.stringify(await wallet._wallet.listAssets()));
    console.log('listUnspents', await wallet._wallet.listUnspents());
    // expect(balance).toBeDefined();
    // expect(balance).toBeGreaterThan(0);

    // const psbt = await wallet._wallet.createUtxosBegin({
    //   // up_to: true,
    //   // num: 5,
    //   // size: 1000,
    //   // fee_rate: 1
    // });
    // // Step 2: Sign the PSBT (synchronous operation)
    // const signed_psbt = await wallet._wallet.signPsbt(psbt);
    // // Step 3: Finalize UTXO creation
    // try {
    //   const utxosCreated = await wallet._wallet.createUtxosEnd({ signed_psbt });
    //   console.log(`Created ${utxosCreated} UTXOs`);
    //   // console.log(utxosCreated.data.detail);
    // } catch (error) {
    //   console.error('Error creating UTXOs:', error);
    //   console.error('Error creating UTXOs:', JSON.stringify(error));
    // }

    // return;
    // const receiveData = await wallet._wallet.witnessReceive({
    //   // asset_id: 'rgb:NR~RUnC3-BFWHRcC-9bhMmIj-Q7EiBin-WWzNWCp-GHSwSdk',
    //   amount: 66,
    // });
    // console.log('Receive data2:', receiveData);
    // return;

    // const receiveData = await wallet._wallet.blindReceive({
    //   // asset_id: 'rgb:NR~RUnC3-BFWHRcC-9bhMmIj-Q7EiBin-WWzNWCp-GHSwSdk',
    //   amount: 1,
    // });
    // console.log('Receive data:', receiveData);
    // return;

    // try {
    //   const sendResult2 = await wallet._wallet.send({
    //     invoice:
    //       'rgb:NR~RUnC3-BFWHRcC-9bhMmIj-Q7EiBin-WWzNWCp-GHSwSdk/RWhwUfTMpuP2Zfx1~j4nswCANGeJrYOqDcKelaMV4zU/~/tb3:utxob:slx7HQOG-6FLSEN3-2J0n4zY-UElKxmg-Whf~ro3-nxXvAFp-qX19H?assignment_name=assetOwner&expiry=1769007841&endpoints=rpcs://proxy.iriswallet.com/0.2/json-rpc',
    //     amount: 5,
    //     asset_id: 'rgb:NR~RUnC3-BFWHRcC-9bhMmIj-Q7EiBin-WWzNWCp-GHSwSdk',
    //     fee_rate: 1,
    //     min_confirmations: 1,
    //   });
    //   console.log('Send result2:', sendResult2);
    //   return;
    // } catch (error) {
    //   console.error('Error sending:', error);
    //   console.error('Error sending:', JSON.stringify(error));
    // }

    // return;
    // const asset = await wallet._wallet.issueAssetNia({
    //   ticker: 'USDT',
    //   name: 'Tether USD',
    //   amounts: [1000, 500],
    //   precision: 6,
    // });

    //   const asset = await wallet._wallet.issueAssetNia({
    //     ticker: "LZ",
    //     name: "Layerz Shares",
    //     amounts: [1000, 500],
    //     precision: 6
    // });

    // console.log('Asset issued:', asset.asset?.assetId);
  }, 60000);
});
