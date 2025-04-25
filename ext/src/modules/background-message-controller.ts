import * as BlueElectrum from '@shared/blue_modules/BlueElectrum';
import { EvmWallet } from '@shared/class/evm-wallet';
import { LiquidWallet } from '@shared/class/wallets/liquid-wallet';
import { WatchOnlyWallet } from '@shared/class/wallets/watch-only-wallet';
import { getDeviceID } from '@shared/modules/device-id';
import { lazyInitWallet, saveArkAddresses, saveBitcoinXpubs, saveLiquidXpubs, saveWalletState } from '@shared/modules/wallet-utils';
import {
  CreateMnemonicResponse,
  EncryptMnemonicRequest,
  EncryptMnemonicResponse,
  GetAddressRequest,
  GetAddressResponse,
  GetBtcBalanceRequest,
  GetBtcBalanceResponse,
  GetBtcSendDataRequest,
  GetBtcSendDataResponse,
  GetLiquidBalanceRequest,
  GetLiquidBalanceResponse,
  GetLiquidSendDataRequest,
  GetLiquidSendDataResponse,
  LogRequest,
  MessageType,
  ProcessRPCRequest,
  SaveMnemonicRequest,
  SaveMnemonicResponse,
  SignPersonalMessageRequest,
  SignPersonalMessageResponse,
  SignTypedDataRequest,
  SignTypedDataResponse,
} from '@shared/types/IBackgroundCaller';
import { ENCRYPTED_PREFIX, STORAGE_KEY_ARK_ADDRESS, STORAGE_KEY_EVM_XPUB, STORAGE_KEY_MNEMONIC } from '@shared/types/IStorage';
import { NETWORK_ARKMUTINYNET, NETWORK_BITCOIN, NETWORK_LIQUID, NETWORK_LIQUIDTESTNET } from '@shared/types/networks';
import { Csprng } from '../../src/class/rng';
import { LayerzStorage } from '../class/layerz-storage';
import { SecureStorage } from '../class/secure-storage';
import { decrypt, encrypt } from '../modules/encryption';

// we only keep bitcoin and liquid wallets in the background for now
type TBackgroundWallets = WatchOnlyWallet | LiquidWallet;
type TBackgroundNetworks = typeof NETWORK_BITCOIN | typeof NETWORK_LIQUID | typeof NETWORK_LIQUIDTESTNET;

const cachedWallets: Record<TBackgroundNetworks, Record<number, TBackgroundWallets>> = {
  [NETWORK_BITCOIN]: {},
  [NETWORK_LIQUID]: {},
  [NETWORK_LIQUIDTESTNET]: {},
};

async function handleGetAddress(request: GetAddressRequest, sendResponse: (response: GetAddressResponse) => void) {
  if (request.network === NETWORK_BITCOIN || request.network === NETWORK_LIQUID || request.network === NETWORK_LIQUIDTESTNET) {
    const wallet = await lazyInitWallet(request.network, request.accountNumber, cachedWallets, LayerzStorage);
    const address = await wallet.getAddressAsync();
    sendResponse(address);
    await saveWalletState(LayerzStorage, wallet, request.network, request.accountNumber);
  } else if (request.network === NETWORK_ARKMUTINYNET) {
    const address = await LayerzStorage.getItem(STORAGE_KEY_ARK_ADDRESS + request.accountNumber);
    sendResponse(address ?? '');
  } else {
    const xpub = await LayerzStorage.getItem(STORAGE_KEY_EVM_XPUB);
    sendResponse(EvmWallet.xpubToAddress(xpub, request.accountNumber));
  }
}

async function handleSaveMnemonic(request: SaveMnemonicRequest, sendResponse: (response: SaveMnemonicResponse) => void) {
  const { mnemonic } = request;

  if (!EvmWallet.isMnemonicValid(mnemonic)) {
    sendResponse({ success: false });
    return;
  }

  const xpub = EvmWallet.mnemonicToXpub(mnemonic);
  await SecureStorage.setItem(STORAGE_KEY_MNEMONIC, mnemonic);
  await LayerzStorage.setItem(STORAGE_KEY_EVM_XPUB, xpub);
  await saveBitcoinXpubs(LayerzStorage, mnemonic);
  await saveArkAddresses(LayerzStorage, mnemonic);
  await saveLiquidXpubs(LayerzStorage, mnemonic);

  sendResponse({ success: true });
}

async function handleCreateMnemonic(sendResponse: (response: CreateMnemonicResponse) => void) {
  const mnemonic = await EvmWallet.generateMnemonic(Csprng);
  const xpub = EvmWallet.mnemonicToXpub(mnemonic);

  await SecureStorage.setItem(STORAGE_KEY_MNEMONIC, mnemonic);
  await LayerzStorage.setItem(STORAGE_KEY_EVM_XPUB, xpub);
  await saveBitcoinXpubs(LayerzStorage, mnemonic);
  await saveArkAddresses(LayerzStorage, mnemonic);
  await saveLiquidXpubs(LayerzStorage, mnemonic);

  sendResponse({ mnemonic });
}

async function handleGetBtcBalance(request: GetBtcBalanceRequest, sendResponse: (response: GetBtcBalanceResponse) => void) {
  if (!BlueElectrum.mainConnected) {
    await BlueElectrum.connectMain();
  }

  const wallet = await lazyInitWallet(NETWORK_BITCOIN, request.accountNumber, cachedWallets, LayerzStorage);
  await wallet.fetchBalance();
  await saveWalletState(LayerzStorage, wallet, NETWORK_BITCOIN, request.accountNumber);

  sendResponse({
    confirmed: wallet.getBalance(),
    unconfirmed: wallet.getUnconfirmedBalance(),
  });
}

async function handleGetBtcSendData(request: GetBtcSendDataRequest, sendResponse: (response: GetBtcSendDataResponse) => void) {
  if (!BlueElectrum.mainConnected) {
    await BlueElectrum.connectMain();
  }
  const wallet = await lazyInitWallet(NETWORK_BITCOIN, request.accountNumber, cachedWallets, LayerzStorage);
  await wallet.fetchBalance();
  await wallet.fetchUtxo();
  const changeAddress = await wallet.getChangeAddressAsync();
  const utxos = wallet.getUtxo();
  await saveWalletState(LayerzStorage, wallet, NETWORK_BITCOIN, request.accountNumber);

  sendResponse({ utxos, changeAddress });
}

async function handleGetLiquidBalance(request: GetLiquidBalanceRequest, sendResponse: (response: GetLiquidBalanceResponse) => void) {
  if (request.network !== NETWORK_LIQUID && request.network !== NETWORK_LIQUIDTESTNET) {
    throw new Error(`Unsupported network: ${request.network}`);
  }
  const wallet = (await lazyInitWallet(request.network, request.accountNumber, cachedWallets, LayerzStorage)) as LiquidWallet;
  await wallet.fetchTransactions();
  const balances = wallet.getBalances();
  await saveWalletState(LayerzStorage, wallet, request.network, request.accountNumber);

  sendResponse(balances);
}

async function handleGetLiquidSendData(request: GetLiquidSendDataRequest, sendResponse: (response: GetLiquidSendDataResponse) => void) {
  if (request.network !== NETWORK_LIQUID && request.network !== NETWORK_LIQUIDTESTNET) {
    throw new Error(`Unsupported network: ${request.network}`);
  }
  const wallet = (await lazyInitWallet(request.network, request.accountNumber, cachedWallets, LayerzStorage)) as LiquidWallet;
  await wallet.fetchTransactions();
  const utxos = wallet.getUtxos();
  await saveWalletState(LayerzStorage, wallet, request.network, request.accountNumber);

  sendResponse({
    utxos,
    txDetails: wallet.txDetails,
    outpointBlindingData: wallet.outpointBlindingData,
    scriptsDetails: wallet.scriptsDetails,
  });
}

async function handleEncryptMnemonic(request: EncryptMnemonicRequest, sendResponse: (response: EncryptMnemonicResponse) => void) {
  const mnemonic = await SecureStorage.getItem(STORAGE_KEY_MNEMONIC);

  if (mnemonic.startsWith(ENCRYPTED_PREFIX)) {
    sendResponse({
      success: false,
      message: 'Cannot encrypt mnemonic that is already encrypted',
    });
    return;
  }

  const deviceId = await getDeviceID(LayerzStorage, Csprng);
  const encrypted = await encrypt(Csprng, mnemonic, request.password, deviceId);

  if (encrypted) {
    await SecureStorage.setItem(STORAGE_KEY_MNEMONIC, ENCRYPTED_PREFIX + encrypted);
    sendResponse({ success: true });
  } else {
    sendResponse({ success: false });
  }
}

async function handleSignPersonalMessage(request: SignPersonalMessageRequest, sendResponse: (response: SignPersonalMessageResponse) => void) {
  const encryptedMnemonic = await SecureStorage.getItem(STORAGE_KEY_MNEMONIC);

  if (!encryptedMnemonic.startsWith(ENCRYPTED_PREFIX)) {
    sendResponse({
      success: false,
      bytes: '',
      message: 'Mnemonic is not encrypted. Please reinstall the extension to fix this issue.',
    });
    return;
  }

  try {
    const deviceId = await getDeviceID(LayerzStorage, Csprng);
    const decrypted = await decrypt(encryptedMnemonic.replace(ENCRYPTED_PREFIX, ''), request.password, deviceId);
    const evm = new EvmWallet();
    const bytes = await evm.signPersonalMessage(request.message, decrypted as string, request.accountNumber);
    sendResponse({ success: true, bytes });
  } catch (error) {
    sendResponse({ success: false, bytes: '', message: 'Bad password' });
  }
}

async function handleSignTypedData(request: SignTypedDataRequest, sendResponse: (response: SignTypedDataResponse) => void) {
  const encryptedMnemonic = await SecureStorage.getItem(STORAGE_KEY_MNEMONIC);

  if (!encryptedMnemonic.startsWith(ENCRYPTED_PREFIX)) {
    sendResponse({
      success: false,
      bytes: '',
      message: 'Mnemonic is not encrypted. Please reinstall the extension to fix this issue.',
    });
    return;
  }

  try {
    const deviceId = await getDeviceID(LayerzStorage, Csprng);
    const decrypted = await decrypt(encryptedMnemonic.replace(ENCRYPTED_PREFIX, ''), request.password, deviceId);
    const evm = new EvmWallet();
    const bytes = await evm.signTypedDataMessage(request.message, decrypted as string, request.accountNumber);
    sendResponse({ success: true, bytes });
  } catch (error) {
    sendResponse({ success: false, bytes: '', message: 'Bad password' });
  }
}

async function handleOpenPopup(request: ProcessRPCRequest, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
  if (!sender.tab?.id) {
    console.error('Cannot open popup: sender.tab?.id is missing');
    sendResponse({ error: true, message: 'Cannot open popup: sender.tab?.id is missing' });
    return;
  }

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

export function handleMessage(msg: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
  switch (msg.type) {
    case MessageType.GET_ADDRESS:
      setTimeout(() => handleGetAddress(msg as GetAddressRequest, sendResponse), 0);
      return true;

    case MessageType.SAVE_MNEMONIC:
      setTimeout(() => handleSaveMnemonic(msg as SaveMnemonicRequest, sendResponse), 1);
      return true;

    case MessageType.CREATE_MNEMONIC:
      setTimeout(() => handleCreateMnemonic(sendResponse), 1);
      return true;

    case MessageType.GET_BTC_BALANCE:
      setTimeout(() => handleGetBtcBalance(msg as GetBtcBalanceRequest, sendResponse), 1);
      return true;

    case MessageType.LOG:
      console.log((msg as LogRequest).data);
      sendResponse();
      return;

    case MessageType.ENCRYPT_MNEMONIC:
      setTimeout(() => handleEncryptMnemonic(msg as EncryptMnemonicRequest, sendResponse), 0);
      return true;

    case MessageType.SIGN_PERSONAL_MESSAGE:
      setTimeout(() => handleSignPersonalMessage(msg as SignPersonalMessageRequest, sendResponse), 0);
      return true;

    case MessageType.SIGN_TYPED_DATA:
      setTimeout(() => handleSignTypedData(msg as SignTypedDataRequest, sendResponse), 0);
      return true;

    case MessageType.OPEN_POPUP:
      setTimeout(() => handleOpenPopup(msg as ProcessRPCRequest, sender, sendResponse), 0);
      return true;

    case MessageType.GET_BTC_SEND_DATA:
      setTimeout(() => handleGetBtcSendData(msg as GetBtcSendDataRequest, sendResponse), 0);
      return true;

    case MessageType.GET_LIQUID_BALANCE:
      setTimeout(() => handleGetLiquidBalance(msg as GetLiquidBalanceRequest, sendResponse), 1);
      return true;

    case MessageType.GET_LIQUID_SEND_DATA:
      setTimeout(() => handleGetLiquidSendData(msg as GetLiquidSendDataRequest, sendResponse), 1);
      return true;

    default:
      console.log('Unknown message type received:', msg);
      sendResponse({ error: true, message: 'Unknown message type received' });
      break;
  }
}
