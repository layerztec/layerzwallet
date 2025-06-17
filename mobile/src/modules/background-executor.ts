import { SecureStorage } from '@/src/class/secure-storage';
import * as BlueElectrum from '@shared/blue_modules/BlueElectrum';
import { EvmWallet } from '@shared/class/evm-wallet';
import { BreezWallet, getBreezNetwork } from '@shared/class/wallets/breez-wallet';
import { WatchOnlyWallet } from '@shared/class/wallets/watch-only-wallet';
import { getDeviceID } from '@shared/modules/device-id';
import { lazyInitWallet as lazyInitWalletOrig, saveArkAddresses, saveBitcoinXpubs, saveSubMnemonics, saveWalletState } from '@shared/modules/wallet-utils';
import { IBackgroundCaller } from '@shared/types/IBackgroundCaller';
import {
  ENCRYPTED_PREFIX,
  STORAGE_KEY_ACCEPTED_TOS,
  STORAGE_KEY_ARK_ADDRESS,
  STORAGE_KEY_EVM_XPUB,
  STORAGE_KEY_MNEMONIC,
  STORAGE_KEY_SUB_MNEMONIC,
  STORAGE_KEY_WHITELIST,
} from '@shared/types/IStorage';
import { NETWORK_ARKMUTINYNET, NETWORK_BITCOIN, NETWORK_LIQUID, NETWORK_LIQUIDTESTNET, NETWORK_SPARK } from '@shared/types/networks';
import { LayerzStorage } from '../class/layerz-storage';
import { Csprng } from '../class/rng';
import { encrypt } from '../modules/encryption';
import { SparkWallet } from '@shared/class/wallets/spark-wallet';

// Cache of wallets by network and account number (currently only bitcoin)
const cachedWallets: Record<string, Record<number, WatchOnlyWallet>> = {
  [NETWORK_BITCOIN]: {},
  // [NETWORK_LIQUID]: {},
  // [NETWORK_LIQUIDTESTNET]: {},
};

const lazyInitWallet = async (...args: Parameters<typeof lazyInitWalletOrig>) => {
  if (args[0] !== NETWORK_BITCOIN) {
    throw new Error('lazyInitWallet only supports NETWORK_BITCOIN');
  }
  return lazyInitWalletOrig(...args) as unknown as WatchOnlyWallet;
};

/**
 * A drop-in replacement for BackgroundCaller in `ext` project. Since we have only one js context on mobile,
 * no need to handle calls via messages, we can just execute them on the spot
 */
export const BackgroundExecutor: IBackgroundCaller = {
  async getAddress(network, accountNumber) {
    if (network === NETWORK_BITCOIN) {
      const wallet = await lazyInitWallet(network, accountNumber, cachedWallets, LayerzStorage);
      const address = await wallet.getAddressAsync();
      await saveWalletState(LayerzStorage, wallet, network, accountNumber);
      return address;
    } else if (network === NETWORK_ARKMUTINYNET) {
      const address = await LayerzStorage.getItem(STORAGE_KEY_ARK_ADDRESS + accountNumber);
      return address;
    } else if (network === NETWORK_SPARK) {
      const sp = new SparkWallet();
      const submnemonic = await BackgroundExecutor.getSubMnemonic(accountNumber);
      sp.setSecret(submnemonic);
      await sp.init();
      return String(await sp.getOffchainReceiveAddress());
    } else if (network === NETWORK_LIQUID || network === NETWORK_LIQUIDTESTNET) {
      const mnemonic = await SecureStorage.getItem(STORAGE_KEY_SUB_MNEMONIC + accountNumber);
      const wallet = new BreezWallet(mnemonic, getBreezNetwork(network));
      const address = wallet.getAddressLiquid();
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
    if (!EvmWallet.isMnemonicValid(mnemonic)) {
      return false;
    }

    const xpub = EvmWallet.mnemonicToXpub(mnemonic);
    await SecureStorage.setItem(STORAGE_KEY_MNEMONIC, mnemonic);
    await LayerzStorage.setItem(STORAGE_KEY_EVM_XPUB, xpub);
    await saveBitcoinXpubs(LayerzStorage, mnemonic);
    await saveArkAddresses(LayerzStorage, mnemonic);
    await saveSubMnemonics(SecureStorage, mnemonic);

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
    await saveArkAddresses(LayerzStorage, mnemonic);
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
    const wallet = await lazyInitWallet(NETWORK_BITCOIN, accountNumber, cachedWallets, LayerzStorage);
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
    alert('Implement me'); // todo
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

  async signPersonalMessage() {
    throw new Error('Implement me'); // TODO
  },

  async signTypedData() {
    throw new Error('Implement me'); // TODO
  },

  async openPopup() {
    throw new Error('Implement me'); // TODO
  },

  async getBtcSendData(accountNumber) {
    if (!BlueElectrum.mainConnected) {
      await BlueElectrum.connectMain();
    }
    const wallet = await lazyInitWallet(NETWORK_BITCOIN, accountNumber, cachedWallets, LayerzStorage);
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
};
