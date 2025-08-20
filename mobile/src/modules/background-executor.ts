import assert from 'assert';

import * as BlueElectrum from '@shared/blue_modules/BlueElectrum';
import { EvmWallet } from '@shared/class/evm-wallet';
import { BreezWallet } from '@shared/class/wallets/breez-wallet';
import { SparkWallet } from '@shared/class/wallets/spark-wallet';
import { WatchOnlyWallet } from '@shared/class/wallets/watch-only-wallet';
import { getDeviceID } from '@shared/modules/device-id';
import {
  lazyInitWallet as lazyInitWalletOrig,
  sanitizeAndValidateMnemonic,
  saveBitcoinXpubs,
  saveSubMnemonics,
  saveWalletState,
  TSupportedLazyInitWalletNetworks,
  clearWalletCache,
} from '@shared/modules/wallet-utils';
import { IBackgroundCaller, OpenPopupRequest } from '@shared/types/IBackgroundCaller';
import { ENCRYPTED_PREFIX, STORAGE_KEY_ACCEPTED_TOS, STORAGE_KEY_EVM_XPUB, STORAGE_KEY_MNEMONIC, STORAGE_KEY_SUB_MNEMONIC, STORAGE_KEY_WHITELIST } from '@shared/types/IStorage';
import { NETWORK_ARK_MUTINYNET, NETWORK_BITCOIN, NETWORK_LIQUID, NETWORK_LIQUID_TESTNET, NETWORK_ROOTSTOCK, NETWORK_SPARK } from '@shared/types/networks';
import { BrowserBridge } from '../class/browser-bridge';
import { LayerzStorage } from '../class/layerz-storage';
import { Csprng } from '../class/rng';
import { SecureStorage } from '../class/secure-storage';
import { decrypt, encrypt } from '../modules/encryption';
import { ArkWallet } from '@shared/class/wallets/ark-wallet';

/**
 * A drop-in replacement for BackgroundCaller in `ext` project. Since we have only one js context on mobile,
 * no need to handle calls via messages, we can just execute them on the spot
 */
export const BackgroundExecutor: IBackgroundCaller = {
  async lazyInitWallet(network: TSupportedLazyInitWalletNetworks, accountNumber: number) {
    return lazyInitWalletOrig(network, accountNumber, LayerzStorage, SecureStorage);
  },

  async getAddress(network, accountNumber) {
    if (network === NETWORK_BITCOIN) {
      const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
      assert(wallet instanceof WatchOnlyWallet);
      const address = await wallet.getAddressAsync();
      await saveWalletState(LayerzStorage, wallet, network, accountNumber);
      return address;
    } else if (network === NETWORK_ARK_MUTINYNET) {
      const aw = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
      assert(aw instanceof ArkWallet);
      return await aw.getOffchainReceiveAddress();
    } else if (network === NETWORK_SPARK) {
      const sp = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
      assert(sp instanceof SparkWallet);
      return String(await sp.getOffchainReceiveAddress());
    } else if (network === NETWORK_LIQUID || network === NETWORK_LIQUID_TESTNET) {
      const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
      assert(wallet instanceof BreezWallet);
      const address = await wallet.getAddressLiquid();
      return address;
    } else {
      const xpub = await LayerzStorage.getItem(STORAGE_KEY_EVM_XPUB);
      return EvmWallet.xpubToAddress(xpub, accountNumber);
    }
  },

  async acceptTermsOfService() {
    await LayerzStorage.setItem(STORAGE_KEY_ACCEPTED_TOS, 'true');
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

  async saveMnemonic(mnemonic) {
    let sanitizedMnemonic = mnemonic;
    try {
      sanitizedMnemonic = sanitizeAndValidateMnemonic(mnemonic);
    } catch (error) {
      return false;
    }

    const xpub = EvmWallet.mnemonicToXpub(sanitizedMnemonic);
    await LayerzStorage.setItem(STORAGE_KEY_EVM_XPUB, xpub);
    await saveBitcoinXpubs(LayerzStorage, sanitizedMnemonic);
    await saveSubMnemonics(SecureStorage, sanitizedMnemonic);
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
    await saveSubMnemonics(SecureStorage, mnemonic);

    return { mnemonic };
  },

  async encryptMnemonic(password) {
    const mnemonic = await SecureStorage.getItem(STORAGE_KEY_MNEMONIC);

    if (mnemonic.startsWith(ENCRYPTED_PREFIX)) {
      return {
        success: false,
        message: 'Cannot encrypt mnemonic that is already encrypted',
      };
    }

    const deviceId = await getDeviceID(SecureStorage, Csprng);
    const encrypted = await encrypt(Csprng, mnemonic, password, deviceId);

    if (encrypted) {
      await SecureStorage.setItem(STORAGE_KEY_MNEMONIC, ENCRYPTED_PREFIX + encrypted);
      return { success: true };
    } else {
      return { success: false };
    }
  },

  async getBtcBalance(accountNumber) {
    if (!BlueElectrum.mainConnected) {
      await BlueElectrum.connectMain();
    }
    const wallet = await BackgroundExecutor.lazyInitWallet(NETWORK_BITCOIN, accountNumber);
    assert(wallet instanceof WatchOnlyWallet);
    await wallet.fetchBalance();
    await saveWalletState(LayerzStorage, wallet, NETWORK_BITCOIN, accountNumber);
    return {
      confirmed: wallet.getBalance(),
      unconfirmed: wallet.getUnconfirmedBalance(),
    };
  },

  async whitelistDapp(dapp) {
    let whitelist: string[] = [];
    try {
      whitelist = JSON.parse(await LayerzStorage.getItem(STORAGE_KEY_WHITELIST));
    } catch {}

    try {
      whitelist.push(dapp);
      const unique = Array.from(new Set(whitelist));
      await LayerzStorage.setItem(STORAGE_KEY_WHITELIST, JSON.stringify(unique));
    } catch {}
  },

  async unwhitelistDapp(dapp) {
    let whitelist: string[] = [];
    try {
      whitelist = JSON.parse(await LayerzStorage.getItem(STORAGE_KEY_WHITELIST));
    } catch {}

    try {
      whitelist = whitelist.filter((item) => item !== dapp);
      await LayerzStorage.setItem(STORAGE_KEY_WHITELIST, JSON.stringify(whitelist));
    } catch {}
  },

  async getWhitelist() {
    try {
      return JSON.parse(await LayerzStorage.getItem(STORAGE_KEY_WHITELIST)) || [];
    } catch {
      return [];
    }
  },

  async log(data) {
    console.log(data);
  },

  async signPersonalMessage(message, accountNumber, password) {
    const encryptedMnemonic = await SecureStorage.getItem(STORAGE_KEY_MNEMONIC);

    if (!encryptedMnemonic.startsWith(ENCRYPTED_PREFIX)) {
      return {
        success: false,
        bytes: '',
        message: 'Mnemonic is not encrypted. Please reinstall the app to fix this issue.',
      };
    }

    try {
      const deviceId = await getDeviceID(SecureStorage, Csprng);
      const decrypted = await decrypt(encryptedMnemonic.replace(ENCRYPTED_PREFIX, ''), password, deviceId);
      const evm = new EvmWallet();
      const bytes = await evm.signPersonalMessage(message, decrypted as string, accountNumber);
      return { success: true, bytes };
    } catch (error) {
      return { success: false, bytes: '', message: 'Bad password' };
    }
  },

  async signTypedData(message, accountNumber, password) {
    const encryptedMnemonic = await SecureStorage.getItem(STORAGE_KEY_MNEMONIC);

    if (!encryptedMnemonic.startsWith(ENCRYPTED_PREFIX)) {
      return {
        success: false,
        bytes: '',
        message: 'Mnemonic is not encrypted. Please reinstall the app to fix this issue.',
      };
    }

    try {
      const deviceId = await getDeviceID(SecureStorage, Csprng);
      const decrypted = await decrypt(encryptedMnemonic.replace(ENCRYPTED_PREFIX, ''), password, deviceId);
      const evm = new EvmWallet();
      const bytes = await evm.signTypedDataMessage(message, decrypted as string, accountNumber);
      return { success: true, bytes };
    } catch (error) {
      return { success: false, bytes: '', message: 'Bad password' };
    }
  },

  async openPopup(...params: OpenPopupRequest) {
    const bridge = BrowserBridge.getInstance();
    if (bridge) {
      const [method, methodParams, id, from] = params;
      bridge.openActionScreen(method, methodParams, from, id);
    } else {
      console.error('BrowserBridge not available for openPopup');
    }
  },

  async getBtcSendData(accountNumber) {
    if (!BlueElectrum.mainConnected) {
      await BlueElectrum.connectMain();
    }
    const wallet = await BackgroundExecutor.lazyInitWallet(NETWORK_BITCOIN, accountNumber);
    assert(wallet instanceof WatchOnlyWallet);
    await wallet.fetchBalance();
    await wallet.fetchUtxo();
    const changeAddress = await wallet.getChangeAddressAsync();
    const utxos = wallet.getUtxo();
    await saveWalletState(LayerzStorage, wallet, NETWORK_BITCOIN, accountNumber);
    return {
      utxos,
      changeAddress,
    };
  },

  async getSubMnemonic(accountNumber) {
    return await SecureStorage.getItem(STORAGE_KEY_SUB_MNEMONIC + accountNumber);
  },

  async getCommonTransactions(network, accountNumber, afterTxid, limit) {
    if (network === NETWORK_BITCOIN) {
      const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
      assert(wallet instanceof WatchOnlyWallet);
      await wallet.fetchTransactions();
      return wallet.getCommonTransactions(afterTxid, limit);
    } else if (network === NETWORK_LIQUID || network === NETWORK_LIQUID_TESTNET) {
      const wallet = await BackgroundExecutor.lazyInitWallet(network, accountNumber);
      assert(wallet instanceof BreezWallet);
      return await wallet.getCommonTransactions(afterTxid, limit);
    }
    return [];
  },

  async clear() {
    clearWalletCache();
  },
};
