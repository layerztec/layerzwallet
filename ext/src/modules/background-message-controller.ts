import * as BlueElectrum from '@shared/blue_modules/BlueElectrum';
import { EvmWallet } from '@shared/class/evm-wallet';
import { LiquidWallet } from '@shared/class/wallets/liquid-wallet';
import { WatchOnlyWallet } from '@shared/class/wallets/watch-only-wallet';
import { getDeviceID } from '@shared/modules/device-id';
import { lazyInitWallet, saveArkAddresses, saveBitcoinXpubs, saveLiquidXpubs, saveWalletState } from '@shared/modules/wallet-utils';
import { IBackgroundCaller, MessageType, MessageTypeMap, OpenPopupRequest, ProcessRPCRequest } from '@shared/types/IBackgroundCaller';
import { ENCRYPTED_PREFIX, STORAGE_KEY_ARK_ADDRESS, STORAGE_KEY_EVM_XPUB, STORAGE_KEY_MNEMONIC } from '@shared/types/IStorage';
import { NETWORK_ARKMUTINYNET, NETWORK_BITCOIN, NETWORK_LIQUID, NETWORK_LIQUIDTESTNET } from '@shared/types/networks';
import { Csprng } from '../../src/class/rng';
import { LayerzStorage } from '../class/layerz-storage';
import { SecureStorage } from '../class/secure-storage';
import { decrypt, encrypt } from '../modules/encryption';

// we only keep bitcoin and liquid wallets in the background for now
type TBackgroundWallets = WatchOnlyWallet | LiquidWallet;
type TBackgroundNetworks = typeof NETWORK_BITCOIN | typeof NETWORK_LIQUID | typeof NETWORK_LIQUIDTESTNET;

// All possible background messages with their params
type TBackgroundMessage = { [K in keyof MessageTypeMap]: { type: K; params: MessageTypeMap[K]['params'] } }[keyof MessageTypeMap];
// Function type for sending a response from background
type TSendResponse = (response: MessageTypeMap[keyof MessageTypeMap]['response'] | { error: true; message: string }) => void;
// Allowed method names for background executor
type TMethods =
  | 'getAddress'
  | 'saveMnemonic'
  | 'createMnemonic'
  | 'getBtcBalance'
  | 'encryptMnemonic'
  | 'signPersonalMessage'
  | 'signTypedData'
  | 'getBtcSendData'
  | 'getLiquidBalance'
  | 'getLiquidSendData';

const cachedWallets: Record<TBackgroundNetworks, Record<number, TBackgroundWallets>> = {
  [NETWORK_BITCOIN]: {},
  [NETWORK_LIQUID]: {},
  [NETWORK_LIQUIDTESTNET]: {},
};

async function handleOpenPopup([method, params, id, from]: OpenPopupRequest, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
  if (!sender.tab?.id) {
    console.error('Cannot open popup: sender.tab?.id is missing');
    sendResponse({ error: true, message: 'Cannot open popup: sender.tab?.id is missing' });
    return;
  }

  const request: ProcessRPCRequest = { method, params, id, from };
  openPopupWindow(request, sendResponse);
}

function openPopupWindow(request: ProcessRPCRequest, sendResponse: (response?: any) => void) {
  const params = encodeURIComponent(JSON.stringify(request.params));

  chrome.windows.getCurrent({ populate: true }, function (currentWindow) {
    const left = (currentWindow?.left ?? 0) + 200;
    const top = (currentWindow?.top ?? 0) + 100;

    chrome.windows.create(
      {
        url: `popup.html#/action?method=${request.method}&id=${request.id}&params=${params}&from=${request.from}`,
        type: 'popup',
        focused: true,
        width: 600,
        height: 800,
        left,
        top,
      },
      () => {
        console.log('Window created');
        sendResponse({ success: true });
      }
    );
  });
}

export const BackgroundExtensionExecutor: Pick<IBackgroundCaller, TMethods> = {
  async getAddress(network, accountNumber) {
    if (network === NETWORK_BITCOIN || network === NETWORK_LIQUID || network === NETWORK_LIQUIDTESTNET) {
      const wallet = await lazyInitWallet(network, accountNumber, cachedWallets, LayerzStorage);
      const address = await wallet.getAddressAsync();
      await saveWalletState(LayerzStorage, wallet, network, accountNumber);
      return address;
    } else if (network === NETWORK_ARKMUTINYNET) {
      const address = await LayerzStorage.getItem(STORAGE_KEY_ARK_ADDRESS + accountNumber);
      return address ?? '';
    } else {
      const xpub = await LayerzStorage.getItem(STORAGE_KEY_EVM_XPUB);
      return EvmWallet.xpubToAddress(xpub, accountNumber);
    }
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
    await saveLiquidXpubs(LayerzStorage, mnemonic);

    return true;
  },

  async createMnemonic() {
    const mnemonic = await EvmWallet.generateMnemonic(Csprng);
    const xpub = EvmWallet.mnemonicToXpub(mnemonic);

    await SecureStorage.setItem(STORAGE_KEY_MNEMONIC, mnemonic);
    await LayerzStorage.setItem(STORAGE_KEY_EVM_XPUB, xpub);
    await saveBitcoinXpubs(LayerzStorage, mnemonic);
    await saveArkAddresses(LayerzStorage, mnemonic);
    await saveLiquidXpubs(LayerzStorage, mnemonic);

    return { mnemonic };
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

  async encryptMnemonic(password) {
    const mnemonic = await SecureStorage.getItem(STORAGE_KEY_MNEMONIC);

    if (mnemonic.startsWith(ENCRYPTED_PREFIX)) {
      return {
        success: false,
        message: 'Cannot encrypt mnemonic that is already encrypted',
      };
    }

    const deviceId = await getDeviceID(LayerzStorage, Csprng);
    const encrypted = await encrypt(Csprng, mnemonic, password, deviceId);

    if (encrypted) {
      await SecureStorage.setItem(STORAGE_KEY_MNEMONIC, ENCRYPTED_PREFIX + encrypted);
      return { success: true };
    } else {
      return { success: false };
    }
  },

  async signPersonalMessage(message, accountNumber, password) {
    const encryptedMnemonic = await SecureStorage.getItem(STORAGE_KEY_MNEMONIC);

    if (!encryptedMnemonic.startsWith(ENCRYPTED_PREFIX)) {
      return {
        success: false,
        bytes: '',
        message: 'Mnemonic is not encrypted. Please reinstall the extension to fix this issue.',
      };
    }

    try {
      const deviceId = await getDeviceID(LayerzStorage, Csprng);
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
        message: 'Mnemonic is not encrypted. Please reinstall the extension to fix this issue.',
      };
    }

    try {
      const deviceId = await getDeviceID(LayerzStorage, Csprng);
      const decrypted = await decrypt(encryptedMnemonic.replace(ENCRYPTED_PREFIX, ''), password, deviceId);
      const evm = new EvmWallet();
      const bytes = await evm.signTypedDataMessage(message, decrypted as string, accountNumber);
      return { success: true, bytes };
    } catch (error) {
      return { success: false, bytes: '', message: 'Bad password' };
    }
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

    return { utxos, changeAddress };
  },

  async getLiquidBalance(network, accountNumber) {
    if (network !== NETWORK_LIQUID && network !== NETWORK_LIQUIDTESTNET) {
      throw new Error(`Unsupported network: ${network}`);
    }
    const wallet = (await lazyInitWallet(network, accountNumber, cachedWallets, LayerzStorage)) as LiquidWallet;
    await wallet.fetchTransactions();
    const balances = wallet.getBalances();
    await saveWalletState(LayerzStorage, wallet, network, accountNumber);

    return balances;
  },

  async getLiquidSendData(network, accountNumber) {
    if (network !== NETWORK_LIQUID && network !== NETWORK_LIQUIDTESTNET) {
      throw new Error(`Unsupported network: ${network}`);
    }
    const wallet = (await lazyInitWallet(network, accountNumber, cachedWallets, LayerzStorage)) as LiquidWallet;
    await wallet.fetchTransactions();
    const utxos = wallet.getUtxos();
    await saveWalletState(LayerzStorage, wallet, network, accountNumber);

    return {
      utxos,
      txDetails: wallet.txDetails,
      outpointBlindingData: wallet.outpointBlindingData,
      scriptsDetails: wallet.scriptsDetails,
    };
  },
};

const callBackgroundMethod = async (method: Function, params: any, sendResponse: Function) => {
  setTimeout(async () => {
    try {
      const result = await method(...params);
      sendResponse(result);
    } catch (error: any) {
      sendResponse({ error: true, message: error.message });
    }
  }, 1);
};

const MessageHandlerMap = {
  [MessageType.GET_ADDRESS]: BackgroundExtensionExecutor.getAddress,
  [MessageType.SAVE_MNEMONIC]: BackgroundExtensionExecutor.saveMnemonic,
  [MessageType.CREATE_MNEMONIC]: BackgroundExtensionExecutor.createMnemonic,
  [MessageType.GET_BTC_BALANCE]: BackgroundExtensionExecutor.getBtcBalance,
  [MessageType.ENCRYPT_MNEMONIC]: BackgroundExtensionExecutor.encryptMnemonic,
  [MessageType.SIGN_PERSONAL_MESSAGE]: BackgroundExtensionExecutor.signPersonalMessage,
  [MessageType.SIGN_TYPED_DATA]: BackgroundExtensionExecutor.signTypedData,
  [MessageType.GET_BTC_SEND_DATA]: BackgroundExtensionExecutor.getBtcSendData,
  [MessageType.GET_LIQUID_BALANCE]: BackgroundExtensionExecutor.getLiquidBalance,
  [MessageType.GET_LIQUID_SEND_DATA]: BackgroundExtensionExecutor.getLiquidSendData,
};

export function handleMessage(msg: TBackgroundMessage, sender: chrome.runtime.MessageSender, sendResponse: TSendResponse) {
  if (msg.type in MessageHandlerMap) {
    const method = MessageHandlerMap[msg.type as keyof typeof MessageHandlerMap];
    callBackgroundMethod(method, msg.params, sendResponse);
    return true;
  }

  switch (msg.type) {
    case MessageType.LOG:
      console.log(msg.params);
      sendResponse();
      return;

    case MessageType.OPEN_POPUP:
      setTimeout(() => handleOpenPopup(msg.params, sender, sendResponse), 0);
      return true;

    default:
      console.log('Unknown message type received:', msg);
      sendResponse({ error: true, message: 'Unknown message type received' });
      break;
  }
}
