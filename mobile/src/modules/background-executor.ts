import { SecureStorage } from '@/src/class/secure-storage';
import { NETWORK_ARKMUTINYNET, NETWORK_BITCOIN, Networks } from '@shared/types/networks';
import * as BlueElectrum from '@shared/blue_modules/BlueElectrum';
import { EvmWallet } from '@shared/class/evm-wallet';
import { ArkWallet } from '@shared/class/wallets/ark-wallet';
import { HDSegwitBech32Wallet } from '@shared/class/wallets/hd-segwit-bech32-wallet';
import { WatchOnlyWallet } from '@shared/class/wallets/watch-only-wallet';
import { getDeviceID } from '@shared/modules/device-id';
import {
  CreateMnemonicResponse,
  EncryptMnemonicResponse,
  GetBtcBalanceResponse,
  GetBtcSendDataResponse,
  GetLiquidBalanceResponse,
  GetLiquidSendDataResponse,
  IBackgroundCaller,
  SaveMnemonicResponse,
  SignPersonalMessageResponse,
  SignTypedDataResponse,
} from '@shared/types/IBackgroundCaller';
import { ENCRYPTED_PREFIX, STORAGE_KEY_ACCEPTED_TOS, STORAGE_KEY_ARK_ADDRESS, STORAGE_KEY_BTC_XPUB, STORAGE_KEY_EVM_XPUB, STORAGE_KEY_MNEMONIC, STORAGE_KEY_WHITELIST } from '@shared/types/IStorage';
import { LayerzStorage } from '../class/layerz-storage';
import { Csprng } from '../class/rng';
import { encrypt } from '../modules/encryption';

// TODO: unify lazyInitBitcoinWallet, saveArkAddresses & saveBitcoinXpubs in SHARED

// Cache of bitcoin wallets keyed by account number
const bitcoinWallets: Record<number, WatchOnlyWallet> = {};

async function lazyInitBitcoinWallet(accountNumber: number): Promise<WatchOnlyWallet> {
  if (bitcoinWallets[accountNumber]) {
    return bitcoinWallets[accountNumber];
  }

  const xpub = await LayerzStorage.getItem(STORAGE_KEY_BTC_XPUB + accountNumber);
  if (!xpub) throw new Error('No xpub for this account number');

  const wallet = new WatchOnlyWallet();
  wallet.setSecret(xpub);
  wallet.init();
  bitcoinWallets[accountNumber] = wallet;

  return wallet;
}

async function saveArkAddresses(mnemonic: string) {
  for (let accountNum = 0; accountNum <= 5; accountNum++) {
    const ark = new ArkWallet();
    ark.setSecret(mnemonic);
    ark.setAccountNumber(accountNum);
    await ark.init();
    const address = await ark.getOffchainReceiveAddress();
    if (address) {
      await LayerzStorage.setItem(STORAGE_KEY_ARK_ADDRESS + accountNum, address);
    }
  }
}

async function saveBitcoinXpubs(mnemonic: string) {
  for (let accountNum = 0; accountNum <= 5; accountNum++) {
    const btcWallet = new HDSegwitBech32Wallet();
    btcWallet.setSecret(mnemonic);
    btcWallet.setDerivationPath(`m/84'/0'/${accountNum}'`); // BIP84
    const btcXpub = btcWallet.getXpub();
    await LayerzStorage.setItem(STORAGE_KEY_BTC_XPUB + accountNum, btcXpub);
  }
}

/**
 * A drop-in replacement for BackgroundCaller in `ext` project. Since we have only one js context on mobile,
 * no need to handle calls via messages, we can just execute them on the spot
 */
export const BackgroundExecutor: IBackgroundCaller = {
  async getAddress(network: Networks, accountNumber: number): Promise<string> {
    if (network === NETWORK_BITCOIN) {
      const wallet = await lazyInitBitcoinWallet(accountNumber);
      const address = await wallet.getAddressAsync();
      return address;
    } else if (network === NETWORK_ARKMUTINYNET) {
      const address = await LayerzStorage.getItem(STORAGE_KEY_ARK_ADDRESS + accountNumber);
      return address ?? '';
    } else {
      const xpub = await LayerzStorage.getItem(STORAGE_KEY_EVM_XPUB);
      return EvmWallet.xpubToAddress(xpub, accountNumber);
    }
  },

  async acceptTermsOfService(): Promise<void> {
    await LayerzStorage.setItem(STORAGE_KEY_ACCEPTED_TOS, 'true');
  },

  async hasAcceptedTermsOfService(): Promise<boolean> {
    return !!(await LayerzStorage.getItem(STORAGE_KEY_ACCEPTED_TOS));
  },

  async hasMnemonic(): Promise<boolean> {
    const mnemonic = await SecureStorage.getItem(STORAGE_KEY_MNEMONIC);
    return !!mnemonic;
  },

  async hasEncryptedMnemonic(): Promise<boolean> {
    const mnemonic = await SecureStorage.getItem(STORAGE_KEY_MNEMONIC);
    return !!mnemonic && mnemonic.startsWith(ENCRYPTED_PREFIX);
  },

  async saveMnemonic(mnemonic: string): Promise<SaveMnemonicResponse> {
    if (!EvmWallet.isMnemonicValid(mnemonic)) {
      return { success: false };
    }

    const xpub = EvmWallet.mnemonicToXpub(mnemonic);
    await SecureStorage.setItem(STORAGE_KEY_MNEMONIC, mnemonic);
    await LayerzStorage.setItem(STORAGE_KEY_EVM_XPUB, xpub);
    await saveBitcoinXpubs(mnemonic);
    await saveArkAddresses(mnemonic);

    return { success: true };
  },

  // onboarding - create
  async createMnemonic(): Promise<CreateMnemonicResponse> {
    const mnemonic = await EvmWallet.generateMnemonic(Csprng);
    const xpub = EvmWallet.mnemonicToXpub(mnemonic);
    await SecureStorage.setItem(STORAGE_KEY_MNEMONIC, mnemonic);
    await LayerzStorage.setItem(STORAGE_KEY_EVM_XPUB, xpub);
    await LayerzStorage.setItem(STORAGE_KEY_EVM_XPUB, xpub);
    await saveBitcoinXpubs(mnemonic);
    await saveArkAddresses(mnemonic);

    return { mnemonic };
  },

  async encryptMnemonic(password: string): Promise<EncryptMnemonicResponse> {
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

  async getBtcBalance(accountNumber: number): Promise<GetBtcBalanceResponse> {
    if (!BlueElectrum.mainConnected) {
      await BlueElectrum.connectMain();
    }

    const wallet = await lazyInitBitcoinWallet(accountNumber);
    await wallet.fetchBalance();

    return {
      confirmed: wallet.getBalance(),
      unconfirmed: wallet.getUnconfirmedBalance(),
    };
  },

  async whitelistDapp(dapp: string): Promise<void> {
    let whitelist: string[] = [];
    try {
      whitelist = JSON.parse(await LayerzStorage.getItem(STORAGE_KEY_WHITELIST));
    } catch {}

    try {
      whitelist.push(dapp);
      const unique = [...new Set(whitelist)];
      await LayerzStorage.setItem(STORAGE_KEY_WHITELIST, JSON.stringify(unique));
    } catch {}
  },

  async unwhitelistDapp(dapp: string): Promise<void> {
    alert('Implement me'); // todo
  },

  async getWhitelist(): Promise<string[]> {
    try {
      return JSON.parse(await LayerzStorage.getItem(STORAGE_KEY_WHITELIST)) || [];
    } catch {
      return [];
    }
  },

  async log(data: string): Promise<void> {
    console.log(data);
  },

  async signPersonalMessage(message: string | Uint8Array, accountNumber: number, password: string): Promise<SignPersonalMessageResponse> {
    throw new Error('Implement me'); // TODO
  },

  async signTypedData(message: any, accountNumber: number, password: string): Promise<SignTypedDataResponse> {
    throw new Error('Implement me'); // TODO
  },

  async openPopup(method: string, params: any, id: number, from: string): Promise<void> {
    throw new Error('Implement me'); // TODO
  },

  async getBtcSendData(accountNumber: number): Promise<GetBtcSendDataResponse> {
    if (!BlueElectrum.mainConnected) {
      await BlueElectrum.connectMain();
    }
    const wallet = await lazyInitBitcoinWallet(accountNumber);
    await wallet.fetchBalance();
    await wallet.fetchUtxo();
    const changeAddress = await wallet.getChangeAddressAsync();
    const utxos = wallet.getUtxo();
    return {
      utxos,
      changeAddress,
    };
  },

  async getLiquidBalance(accountNumber: number): Promise<GetLiquidBalanceResponse> {
    throw new Error('Function not implemented.');
  },
  async getLiquidSendData(accountNumber: number): Promise<GetLiquidSendDataResponse> {
    throw new Error('Function not implemented.');
  },
};
