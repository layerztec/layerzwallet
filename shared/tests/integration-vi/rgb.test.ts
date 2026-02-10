import { describe, expect, it, beforeAll, assert } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import type { IRGBAdapter, RGBConnection } from '../../class/wallets/rgb-wallet';

const TIMEOUT = 60000;

// Backup file location and password
const BACKUP_FILE = path.join(__dirname, '../fixtures/rgb_backup.rgb');
const BACKUP_PASSWORD = '123321';

describe('RGB Integration', () => {
  let testDataDir: string;
  let adapter: IRGBAdapter;
  let connection: RGBConnection;

  describe('rgbAdapter', () => {
    it('should have api methods defined', async () => {
      adapter = globalThis.rgbAdapter;
      expect(adapter).toBeDefined();
      expect(adapter.api).toBeDefined();
      expect(adapter.api.registerWallet).toBeDefined();
      expect(adapter.api.getBtcBalance).toBeDefined();
      expect(adapter.api.listAssets).toBeDefined();
    });

    it('should have deriveKeysFromMnemonic defined', async () => {
      adapter = globalThis.rgbAdapter;
      expect(adapter.deriveKeysFromMnemonic).toBeDefined();
    });
  });

  describe('Restore from backup', () => {
    beforeAll(async () => {
      // Create a unique temp directory for this test
      testDataDir = path.join(os.tmpdir(), `rgb-test-${Date.now()}`);
      fs.mkdirSync(testDataDir, { recursive: true });

      // Verify backup file exists
      assert(fs.existsSync(BACKUP_FILE), `Backup file not found: ${BACKUP_FILE}`);

      adapter = globalThis.rgbAdapter;

      console.log('Restoring from backup...');
      console.log('Backup file:', BACKUP_FILE);
      console.log('Data dir:', testDataDir);

      // For backup restore, we need to use the SDK directly since it's a standalone function
      // This is testing the raw SDK, not the adapter pattern
      const sdk = await import('@utexo/rgb-sdk');
      const restoreResult = sdk.restoreFromBackup({
        backupFilePath: BACKUP_FILE,
        password: BACKUP_PASSWORD,
        dataDir: testDataDir,
      });
      console.log('Restore result:', restoreResult);
      expect(restoreResult.message).toBe('Wallet restored successfully');

      // Create connection params
      assert(process.env.TEST_MNEMONIC, 'TEST_MNEMONIC not set');
      connection = {
        mnemonic: process.env.TEST_MNEMONIC,
        network: 'testnet',
        dataDir: testDataDir,
        transportEndpoint: 'rpc://proxy.iriswallet.com/0.2/json-rpc',
        indexerUrl: 'ssl://electrum.iriswallet.com:50013', // Testnet3 server
      };
    }, TIMEOUT);

    it('should have restored files in dataDir', async () => {
      const files = fs.readdirSync(testDataDir);
      console.log('Restored files:', files);
      expect(files.length).toBeGreaterThan(0);

      // Should have master fingerprint directory
      expect(files).toContain('dd80d908');
    });

    it('should get address from restored wallet (offline)', async () => {
      const address = await adapter.api.getAddress(connection);
      console.log('Address:', address);

      expect(address).toBeDefined();
      expect(address).toMatch(/^tb1/); // testnet taproot address
    });

    it('should have correct master fingerprint', async () => {
      const keys = await adapter.deriveKeysFromMnemonic('testnet', process.env.TEST_MNEMONIC!);
      console.log('Master fingerprint:', keys.masterFingerprint);
      expect(keys.masterFingerprint).toBe('dd80d908');
    });

    // Skip online tests for now - WASM networking issues in Node.js
    it('should have tokens after restore (requires online)', async () => {
      const registerResult = await adapter.api.registerWallet(connection);
      console.log('Register result:', registerResult);

      const assets = await adapter.api.listAssets(connection);
      console.log('Assets:', JSON.stringify(assets, null, 2));

      expect(assets.nia).toBeDefined();
      expect(assets.nia.length).toBeGreaterThan(0);
    });

    it.skip('should get transactions (requires online)', async () => {
      const transactions = await adapter.api.listTransactions(connection);
      console.log('Transactions:', transactions.length);
      expect(Array.isArray(transactions)).toBe(true);
    });
  });
});
