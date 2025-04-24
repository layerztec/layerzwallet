import assert from 'assert';
import { describe, it, vi } from 'vitest';
import { LiquidWallet } from '../../class/wallets/liquid-wallet';
import { WatchOnlyWallet } from '../../class/wallets/watch-only-wallet';
import { WalletSerializer } from '../../modules/wallet-serializer';

describe('WalletSerializer', () => {
  it('should serialize and deserialize a LiquidWallet', async () => {
    const originalWallet = new LiquidWallet('liquid');
    await originalWallet.init({ mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about' });

    const serialized = await WalletSerializer.serializeToObject(originalWallet);
    assert.strictEqual(serialized.version, 1);
    assert.strictEqual(serialized.type, 'LiquidWallet');
    assert.ok('secret' in serialized.data);
    assert.strictEqual(serialized.data.networkString, 'liquid');
    assert.ok('masterBlindingKey' in serialized.data);

    const deserialized = await WalletSerializer.deserializeFromObject(serialized);
    if (!(deserialized instanceof LiquidWallet)) {
      throw new Error('Expected deserialized wallet to be LiquidWallet');
    }
    assert.strictEqual(deserialized.getSecret(), originalWallet.getSecret());
    assert.strictEqual(deserialized.networkString, originalWallet.networkString);
  });

  it('should serialize and deserialize a WatchOnlyWallet', async () => {
    const originalWallet = new WatchOnlyWallet();
    originalWallet.setSecret('zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs');
    originalWallet.init();

    const serialized = await WalletSerializer.serializeToObject(originalWallet);
    assert.strictEqual(serialized.version, 1);
    assert.strictEqual(serialized.type, 'watchOnly');
    assert.ok('secret' in serialized.data);
    assert.strictEqual(serialized.data.isWatchOnlyWarningVisible, true);
    assert.strictEqual(serialized.data.use_with_hardware_wallet, false);

    const deserialized = await WalletSerializer.deserializeFromObject(serialized);
    if (!(deserialized instanceof WatchOnlyWallet)) {
      throw new Error('Expected deserialized wallet to be WatchOnlyWallet');
    }
    assert.strictEqual(deserialized.getSecret(), originalWallet.getSecret());
    assert.strictEqual(deserialized.isWatchOnlyWarningVisible, originalWallet.isWatchOnlyWarningVisible);
  });

  describe('migration', () => {
    it('should apply migrations', async () => {
      const wallet = new LiquidWallet('liquid');
      await wallet.init({ mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about' });

      const serialized = await WalletSerializer.serializeToObject(wallet);
      serialized.version = -1; // Set to an older version

      // Add a migration that sets networkString to test
      const originalMigrations = WalletSerializer.migrations;
      const migrationSpy = vi.fn((data) => ({ ...data, networkString: 'test' }));
      WalletSerializer.migrations = { 1: migrationSpy };

      try {
        const deserialized = await WalletSerializer.deserializeFromObject(serialized);
        if (!(deserialized instanceof LiquidWallet)) {
          throw new Error('Expected deserialized wallet to be LiquidWallet');
        }
        assert.strictEqual(deserialized.networkString, 'test');
        assert.strictEqual(migrationSpy.mock.calls.length, 1);
      } finally {
        // Restore original migrations
        WalletSerializer.migrations = originalMigrations;
      }
    });

    it('should throw error on failed migration', async () => {
      const wallet = new LiquidWallet('liquid');
      await wallet.init({ mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about' });

      const serialized = await WalletSerializer.serializeToObject(wallet);
      serialized.version = 0; // Set to an older version

      // Add a failing migration
      const originalMigrations = WalletSerializer.migrations;
      WalletSerializer.migrations = {
        ...originalMigrations,
        1: () => {
          throw new Error('Test migration error');
        },
      };

      try {
        await WalletSerializer.deserializeFromObject(serialized);
        assert.fail('Expected an error to be thrown');
      } catch (error) {
        assert.ok((error as Error).message.includes('Failed to migrate LiquidWallet wallet data to 1'));
      } finally {
        // Restore original migrations
        WalletSerializer.migrations = originalMigrations;
      }
    });
  });
});
