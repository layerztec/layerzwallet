import { describe, expect, it, beforeAll, assert } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const TIMEOUT = 60000;

// Backup file location and password
const BACKUP_FILE = path.join(__dirname, '../fixtures/rgb_backup.rgb');
const BACKUP_PASSWORD = '123321';

describe('RGB Integration', () => {
  let testDataDir: string;
  let sdk: any;
  let wallet: any;

  describe('rgbAdapter', () => {
    it('should initialize and return SDK', async () => {
      sdk = await globalThis.rgbAdapter.initialize();
      expect(sdk).toBeDefined();
      expect(sdk.createWallet).toBeDefined();
    });

    it('should return cached SDK on subsequent calls', async () => {
      const sdk1 = await globalThis.rgbAdapter.initialize();
      const sdk2 = await globalThis.rgbAdapter.initialize();
      expect(sdk1).toBe(sdk2);
    });
  });

  describe('Restore from backup', () => {
    beforeAll(async () => {
      // Create a unique temp directory for this test
      testDataDir = path.join(os.tmpdir(), `rgb-test-${Date.now()}`);
      fs.mkdirSync(testDataDir, { recursive: true });

      // Verify backup file exists
      assert(fs.existsSync(BACKUP_FILE), `Backup file not found: ${BACKUP_FILE}`);

      // Initialize SDK
      sdk = await globalThis.rgbAdapter.initialize();

      console.log('Restoring from backup...');
      console.log('Backup file:', BACKUP_FILE);
      console.log('Data dir:', testDataDir);

      // Restore wallet from backup
      const restoreResult = sdk.restoreFromBackup({
        backupFilePath: BACKUP_FILE,
        password: BACKUP_PASSWORD,
        dataDir: testDataDir,
      });
      console.log('Restore result:', restoreResult);
      expect(restoreResult.message).toBe('Wallet restored successfully');

      // Create wallet manager
      assert(process.env.TEST_MNEMONIC, 'TEST_MNEMONIC not set');
      const keys = await sdk.deriveKeysFromMnemonic('testnet', process.env.TEST_MNEMONIC);

      wallet = new sdk.WalletManager({
        xpubVan: keys.accountXpubVanilla,
        xpubCol: keys.accountXpubColored,
        masterFingerprint: keys.masterFingerprint,
        mnemonic: keys.mnemonic,
        network: 'testnet',
        dataDir: testDataDir,
        transportEndpoint: 'rpc://proxy.iriswallet.com/0.2/json-rpc',
        indexerUrl: 'ssl://electrum.iriswallet.com:50013', // Testnet3 server
      });
    }, TIMEOUT);

    it('should have restored files in dataDir', async () => {
      const files = fs.readdirSync(testDataDir);
      console.log('Restored files:', files);
      expect(files.length).toBeGreaterThan(0);

      // Should have master fingerprint directory
      expect(files).toContain('dd80d908');
    });

    it('should get address from restored wallet (offline)', async () => {
      const address = wallet.getAddress();
      console.log('Address:', address);

      expect(address).toBeDefined();
      expect(address).toMatch(/^tb1/); // testnet taproot address
    });

    it('should have correct master fingerprint', async () => {
      const keys = await sdk.deriveKeysFromMnemonic('testnet', process.env.TEST_MNEMONIC);
      console.log('Master fingerprint:', keys.masterFingerprint);
      expect(keys.masterFingerprint).toBe('dd80d908');
    });

    // Skip online tests for now - WASM networking issues in Node.js
    it('should have tokens after restore (requires online)', async () => {
      const registerResult = wallet.registerWallet();
      console.log('Register result:', registerResult);

      const assets = wallet.listAssets();
      console.log('Assets:', JSON.stringify(assets, null, 2));

      expect(assets.nia).toBeDefined();
      expect(assets.nia.length).toBeGreaterThan(0);
    });

    it.skip('should get transactions (requires online)', async () => {
      const transactions = wallet.listTransactions();
      console.log('Transactions:', transactions.length);
      expect(Array.isArray(transactions)).toBe(true);
    });
  });
});
