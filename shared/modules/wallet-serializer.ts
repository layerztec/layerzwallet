import { AbstractHDElectrumWallet } from '../class/wallets/abstract-hd-electrum-wallet';
import { LiquidWallet } from '../class/wallets/liquid-wallet';
import { WatchOnlyWallet } from '../class/wallets/watch-only-wallet';
import { HDSegwitBech32Wallet } from '../class/wallets/hd-segwit-bech32-wallet';

export interface ISerializedWallet {
  version: number;
  type: string;
  data: any;
}

type TWatchOnlyProperties = keyof WatchOnlyWallet | `_hdWalletInstance.${keyof HDSegwitBech32Wallet}`;
type TAllProperties = (keyof AbstractHDElectrumWallet | keyof LiquidWallet | keyof WatchOnlyWallet | TWatchOnlyProperties)[];

export class WalletSerializer {
  private static CURRENT_VERSION = 1;
  public static migrations: Record<number, (data: any) => any> = {
    // Example migration from version 1 to 2:
    // 2: (data) => {
    //   return {
    //     ...data,
    //     newField: 'default value'
    //   };
    // }
  };

  // Common properties for all wallets
  public static readonly COMMON_PROPERTIES: (keyof AbstractHDElectrumWallet)[] = [
    '_hideTransactionsInWalletsList',
    '_utxoMetadata',
    'label',
    'preferredBalanceUnit',
    'secret',
    'type',
    'userHasSavedExport',
  ];

  // Properties specific to LiquidWallet
  public static readonly LIQUID_WALLET_PROPERTIES: (keyof LiquidWallet)[] = [
    '_derivationPath',
    '_xpub',
    'assetRegistry',
    'masterBlindingKey',
    'networkString',
    'next_free_address_index',
    'next_free_change_address_index',
    'outpointBlindingData',
    'scripts',
    'scriptsDetails',
    'txDetails',
    'txIDs',
  ];

  public static readonly HD_WALLET_PROPERTIES: (keyof HDSegwitBech32Wallet)[] = [
    '_addresses_by_payment_code_receive',
    '_addresses_by_payment_code_send',
    '_balances_by_external_index',
    '_balances_by_internal_index',
    '_balances_by_payment_code_index',
    '_derivationPath',
    '_enable_BIP47',
    '_lastBalanceFetch',
    '_lastTxFetch',
    '_next_free_payment_code_address_index_receive',
    '_next_free_payment_code_address_index_send',
    '_payment_code',
    '_receive_payment_codes',
    '_send_payment_codes',
    '_txs_by_external_index',
    '_txs_by_external_index',
    '_txs_by_internal_index',
    '_txs_by_internal_index',
    '_txs_by_payment_code_index',
    '_utxo',
    'balance',
    'gap_limit',
    'next_free_address_index',
    'next_free_change_address_index',
    'unconfirmed_balance',
    'unconfirmed_balance',
  ];

  // Properties specific to WatchOnlyWallet
  public static readonly WATCH_ONLY_WALLET_PROPERTIES: TWatchOnlyProperties[] = [
    'isWatchOnlyWarningVisible',
    'use_with_hardware_wallet',
    'masterFingerprint',
    ...(WalletSerializer.HD_WALLET_PROPERTIES.map((p) => `_hdWalletInstance.${p}`) as TWatchOnlyProperties[]),
  ];

  private static getNestedValue(obj: any, path: string): any {
    if (!path.includes('.')) {
      return obj[path];
    }
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private static setNestedValue(obj: any, path: string, value: any): void {
    if (value === undefined) {
      return;
    }
    if (!path.includes('.')) {
      obj[path] = value;
      return;
    }
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) {
        current[key] = {};
      }
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  static async serializeToObject(wallet: LiquidWallet | WatchOnlyWallet): Promise<ISerializedWallet> {
    const data: any = {};

    const properties: TAllProperties = [...this.COMMON_PROPERTIES];
    if (wallet instanceof LiquidWallet) {
      properties.push(...this.LIQUID_WALLET_PROPERTIES);
    } else if (wallet instanceof WatchOnlyWallet) {
      properties.push(...this.WATCH_ONLY_WALLET_PROPERTIES);
    } else {
      throw new Error(`Unknown wallet type: ${(wallet as any).type}`);
    }

    for (const prop of properties) {
      const value = this.getNestedValue(wallet, prop);
      this.setNestedValue(data, prop, value);
    }

    return {
      version: this.CURRENT_VERSION,
      type: wallet.type,
      data,
    };
  }

  static async serialize(wallet: LiquidWallet | WatchOnlyWallet): Promise<string> {
    const serialized = await this.serializeToObject(wallet);
    return JSON.stringify(serialized);
  }

  /**
   * Deserialize a wallet from structured object
   */
  static async deserializeFromObject(serialized: ISerializedWallet): Promise<LiquidWallet | WatchOnlyWallet> {
    const { type, data } = this.migrate(serialized);
    let wallet: LiquidWallet | WatchOnlyWallet;

    switch (type) {
      case LiquidWallet.type:
        wallet = new LiquidWallet(data.networkString);
        if (data.secret) {
          await wallet.init({ mnemonic: data.secret });
        } else if (data._xpub && data.masterBlindingKey) {
          await wallet.init({ xpub: data._xpub, masterBlindingKey: data.masterBlindingKey });
        }
        break;

      case WatchOnlyWallet.type:
        wallet = new WatchOnlyWallet();
        wallet.setSecret(data.secret);
        wallet.init();
        break;

      default:
        throw new Error(`Unknown wallet type: ${type}`);
    }

    const properties: TAllProperties = [...this.COMMON_PROPERTIES];
    if (type === LiquidWallet.type) {
      properties.push(...this.LIQUID_WALLET_PROPERTIES);
    } else if (type === WatchOnlyWallet.type) {
      if (!(wallet as WatchOnlyWallet)._hdWalletInstance) {
        throw new Error('WatchOnlyWallet instance not initialized');
      }
      properties.push(...this.WATCH_ONLY_WALLET_PROPERTIES);
    }

    for (const prop of properties) {
      const value = this.getNestedValue(data, prop);
      this.setNestedValue(wallet, prop, value);
    }

    return wallet;
  }

  static async deserialize(json: string): Promise<LiquidWallet | WatchOnlyWallet> {
    const serialized = JSON.parse(json) as ISerializedWallet;
    return this.deserializeFromObject(serialized);
  }

  private static migrate(serialized: ISerializedWallet): ISerializedWallet {
    let currentData = serialized.data;
    let currentVersion = serialized.version;

    while (currentVersion < this.CURRENT_VERSION) {
      const nextVersion = currentVersion + 1;
      const migration = this.migrations[nextVersion];

      if (!migration) {
        currentVersion = nextVersion;
        continue;
      }

      try {
        currentData = migration(currentData);
        currentVersion = nextVersion;
      } catch (error) {
        throw new Error(
          `Failed to migrate ${serialized.type} wallet data to ${nextVersion}. ` +
            `Error: ${error instanceof Error ? error.message : String(error)}. ` +
            `Current data: ${JSON.stringify(currentData, null, 2)}`
        );
      }
    }

    return {
      version: this.CURRENT_VERSION,
      type: serialized.type,
      data: currentData,
    };
  }
}
