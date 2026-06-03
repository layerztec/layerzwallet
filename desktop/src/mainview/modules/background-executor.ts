import assert from "assert";

import * as BlueElectrum from "@shared/blue_modules/BlueElectrum";
import { EvmWallet } from "@shared/class/evm-wallet";
import { BreezWallet } from "@shared/class/wallets/breez-wallet";
import { SparkWallet } from "@shared/class/wallets/spark-wallet";
import { WatchOnlyWallet } from "@shared/class/wallets/watch-only-wallet";
import { getDeviceID } from "@shared/modules/device-id";
import {
  lazyInitWallet as lazyInitWalletOrig,
  lazyInitWalletReady as lazyInitWalletReadyOrig,
  setMasterSeed as setMasterSeedOrig,
  getMasterSeed as getMasterSeedOrig,
  sanitizeAndValidateMnemonic,
  saveBitcoinXpubs,
  saveWalletState,
  TSupportedLazyInitWalletNetworks,
  clearWalletCache,
} from "@shared/modules/wallet-utils";
import {
  IBackgroundCaller,
  OpenPopupRequest,
} from "@shared/types/IBackgroundCaller";
import {
  ENCRYPTED_PREFIX,
  STORAGE_KEY_ACCEPTED_TOS,
  STORAGE_KEY_EVM_XPUB,
  STORAGE_KEY_MNEMONIC,
  STORAGE_KEY_SEED_VERIFIED,
} from "@shared/types/IStorage";
import {
  Networks,
  NETWORK_BITCOIN,
  NETWORK_LIQUID,
  NETWORK_LIQUID_TESTNET,
  NETWORK_SPARK,
  NETWORK_STACKS,
} from "@shared/types/networks";
import { LayerzStorage } from "../class/layerz-storage";
import { Csprng } from "../class/rng";
import { SecureStorage } from "../class/secure-storage";
import { encrypt } from "../modules/encryption";
import { StacksWallet } from "@shared/class/wallets/stacks-wallet";
import { HDSegwitBech32Wallet } from "@shared/class/wallets/hd-segwit-bech32-wallet";

/**
 * Returns the onchain deposit address (boarding address) for Spark.
 * Used by the NativeDeposit transfer flow.
 */
export async function getOnchainDepositAddress(
  network: Networks,
  accountNumber: number,
): Promise<string> {
  if (network === NETWORK_SPARK) {
    const w = await lazyInitWalletOrig(
      network,
      accountNumber,
      LayerzStorage,
      SecureStorage,
    );
    assert(w instanceof SparkWallet);
    return await w.getOnchainDepositAddress();
  }
  throw new Error(`Network ${network} does not support onchain deposits`);
}

/**
 * Direct `IBackgroundCaller` implementation for desktop (single JS context, no extension messaging).
 * dApp browser / in-page provider is not supported on this build target.
 */
export const BackgroundExecutor: IBackgroundCaller = {
  setMasterSeed(seed: string): Promise<void> {
    setMasterSeedOrig(seed);
    return Promise.resolve();
  },

  getMasterSeed(): Promise<string> {
    const masterSeed = getMasterSeedOrig();
    if (masterSeed) {
      return Promise.resolve(masterSeed);
    } else {
      throw new Error("Internal error: master seed not loaded");
    }
  },

  async lazyInitWallet(
    network: TSupportedLazyInitWalletNetworks,
    accountNumber: number,
  ) {
    return lazyInitWalletOrig(
      network,
      accountNumber,
      LayerzStorage,
      SecureStorage,
    );
  },

  lazyInitWalletReady(
    network: TSupportedLazyInitWalletNetworks,
    accountNumber: number,
  ) {
    return lazyInitWalletReadyOrig(network, accountNumber);
  },

  async getAddress(network, accountNumber) {
    if (network === NETWORK_BITCOIN) {
      const wallet = await BackgroundExecutor.lazyInitWallet(
        network,
        accountNumber,
      );
      assert(wallet instanceof WatchOnlyWallet);
      const address = await wallet.getAddressAsync();
      await saveWalletState(LayerzStorage, wallet, network, accountNumber);
      return address;
    } else if (network === NETWORK_SPARK) {
      const sp = await BackgroundExecutor.lazyInitWallet(
        network,
        accountNumber,
      );
      assert(sp instanceof SparkWallet);
      return String(await sp.getOffchainReceiveAddress());
    } else if (network === NETWORK_STACKS) {
      const sp = await BackgroundExecutor.lazyInitWallet(
        network,
        accountNumber,
      );
      assert(sp instanceof StacksWallet);
      return String(await sp.getOffchainReceiveAddress());
    } else if (
      network === NETWORK_LIQUID ||
      network === NETWORK_LIQUID_TESTNET
    ) {
      const wallet = await BackgroundExecutor.lazyInitWallet(
        network,
        accountNumber,
      );
      assert(wallet instanceof BreezWallet);
      const address = await wallet.getAddressLiquid();
      return address;
    } else {
      const xpub = await LayerzStorage.getItem(STORAGE_KEY_EVM_XPUB);
      return EvmWallet.xpubToAddress(xpub, accountNumber);
    }
  },

  async acceptTermsOfService() {
    await LayerzStorage.setItem(STORAGE_KEY_ACCEPTED_TOS, "true");
  },

  async hasAcceptedTermsOfService() {
    return !!(await LayerzStorage.getItem(STORAGE_KEY_ACCEPTED_TOS));
  },

  async hasMnemonic() {
    const mnemonic = await SecureStorage.getItem(STORAGE_KEY_MNEMONIC);
    return !!mnemonic;
  },

  async hasEncryptedMnemonic() {
    const mnemonic = await SecureStorage.getItem(STORAGE_KEY_MNEMONIC);
    return !!mnemonic && mnemonic.startsWith(ENCRYPTED_PREFIX);
  },

  async hasSeedVerified() {
    return !!(await LayerzStorage.getItem(STORAGE_KEY_SEED_VERIFIED));
  },

  async setSeedVerified() {
    await LayerzStorage.setItem(STORAGE_KEY_SEED_VERIFIED, "true");
  },

  async getMnemonicForVerification() {
    const mnemonic = await SecureStorage.getItem(STORAGE_KEY_MNEMONIC);
    // During onboarding, mnemonic should not be encrypted yet
    if (mnemonic && !mnemonic.startsWith(ENCRYPTED_PREFIX)) {
      return mnemonic;
    }
    return null;
  },

  async saveMnemonic(mnemonic) {
    let sanitizedMnemonic = mnemonic;
    try {
      sanitizedMnemonic = sanitizeAndValidateMnemonic(mnemonic);
    } catch {
      return false;
    }

    const xpub = EvmWallet.mnemonicToXpub(sanitizedMnemonic);
    await LayerzStorage.setItem(STORAGE_KEY_EVM_XPUB, xpub);
    await saveBitcoinXpubs(LayerzStorage, sanitizedMnemonic);
    // we are saving master mnemonic at the end, so that if any of the above fails, we don't end up with a partially working wallet
    await SecureStorage.setItem(STORAGE_KEY_MNEMONIC, sanitizedMnemonic);

    return true;
  },

  // onboarding - create
  async createMnemonic() {
    const mnemonic = await EvmWallet.generateMnemonic(Csprng);
    const xpub = EvmWallet.mnemonicToXpub(mnemonic);
    await SecureStorage.setItem(STORAGE_KEY_MNEMONIC, mnemonic);
    await LayerzStorage.setItem(STORAGE_KEY_EVM_XPUB, xpub);
    await LayerzStorage.setItem(STORAGE_KEY_EVM_XPUB, xpub);
    await saveBitcoinXpubs(LayerzStorage, mnemonic);

    return { mnemonic };
  },

  async encryptMnemonic(password) {
    const mnemonic = await SecureStorage.getItem(STORAGE_KEY_MNEMONIC);

    if (mnemonic.startsWith(ENCRYPTED_PREFIX)) {
      return {
        success: false,
        message: "Cannot encrypt mnemonic that is already encrypted",
      };
    }

    const deviceId = await getDeviceID(SecureStorage, Csprng);
    const encrypted = await encrypt(Csprng, mnemonic, password, deviceId);

    if (encrypted) {
      await SecureStorage.setItem(
        STORAGE_KEY_MNEMONIC,
        ENCRYPTED_PREFIX + encrypted,
      );
      return { success: true };
    } else {
      return { success: false };
    }
  },

  async getBtcBalance(accountNumber) {
    if (!BlueElectrum.mainConnected) {
      await BlueElectrum.connectMain();
    }
    const wallet = await BackgroundExecutor.lazyInitWallet(
      NETWORK_BITCOIN,
      accountNumber,
    );
    assert(wallet instanceof WatchOnlyWallet);
    await wallet.fetchBalance();
    await saveWalletState(
      LayerzStorage,
      wallet,
      NETWORK_BITCOIN,
      accountNumber,
    );
    return {
      confirmed: wallet.getBalance(),
      unconfirmed: wallet.getUnconfirmedBalance(),
    };
  },

  async whitelistDapp(_dapp: string) {},

  async unwhitelistDapp(_dapp: string) {},

  async getWhitelist() {
    return [];
  },

  async log(data) {
    console.log(data);
  },

  async openPopup(..._params: OpenPopupRequest) {},

  async getBtcSendData(accountNumber) {
    if (!BlueElectrum.mainConnected) {
      await BlueElectrum.connectMain();
    }
    const wallet = await BackgroundExecutor.lazyInitWallet(
      NETWORK_BITCOIN,
      accountNumber,
    );
    assert(wallet instanceof WatchOnlyWallet);
    await wallet.fetchBalance();
    await wallet.fetchUtxo();
    const changeAddress = await wallet.getChangeAddressAsync();
    const utxos = wallet.getUtxo();
    await saveWalletState(
      LayerzStorage,
      wallet,
      NETWORK_BITCOIN,
      accountNumber,
    );
    assert(
      wallet._hdWalletInstance instanceof HDSegwitBech32Wallet,
      "Internal error: not an instance of HDSegwitBech32Wallet",
    );
    return {
      utxos,
      changeAddress,
      extraProperties: {
        internal_addresses_cache:
          wallet._hdWalletInstance.internal_addresses_cache,
        external_addresses_cache:
          wallet._hdWalletInstance.external_addresses_cache,
        next_free_address_index:
          wallet._hdWalletInstance.next_free_address_index,
        next_free_change_address_index:
          wallet._hdWalletInstance.next_free_change_address_index,
      },
    };
  },

  async getCommonTransactions(network, accountNumber, afterTxid, limit) {
    if (network === NETWORK_BITCOIN) {
      // electrum is already initialized in getBtcBalance, so we can't call connectMain again
      await BlueElectrum.waitTillConnected();
      const wallet = await BackgroundExecutor.lazyInitWallet(
        network,
        accountNumber,
      );
      assert(wallet instanceof WatchOnlyWallet);
      await wallet.fetchTransactions();
      return wallet.getCommonTransactions(afterTxid, limit);
    } else if (
      network === NETWORK_LIQUID ||
      network === NETWORK_LIQUID_TESTNET
    ) {
      const wallet = await BackgroundExecutor.lazyInitWallet(
        network,
        accountNumber,
      );
      assert(wallet instanceof BreezWallet);
      return await wallet.getCommonTransactions();
    }
    return [];
  },

  async clear() {
    clearWalletCache();
  },
};
