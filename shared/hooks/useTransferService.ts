import { SparkWallet } from '../class/wallets/spark-wallet';
import { FakeTransferService } from '../services/transfer-service-fake';
import { FlashnetTransferService } from '../services/transfer-service-flashnet';
import { GardenTransferService } from '../services/transfer-service-garden';
import { TransferServiceManager } from '../services/transfer-service-manager';
import { NativeDepositSwapsFetcher, NativeDepositTransferService } from '../services/transfer-service-native-deposit';
import { SideshiftTransferService } from '../services/transfer-service-sideshift';
import { SymbiosisTransferService } from '../services/transfer-service-symbiosis';
import { IStorage } from '../types/IStorage';
import { ITransferService } from '../types/transfer';

let _instance: TransferServiceManager | undefined;
let _nativeDepositService: NativeDepositTransferService | undefined;

export function setNativeDepositSwapsFetcher(fn: NativeDepositSwapsFetcher): void {
  _nativeDepositService?.setSwapsFetcher(fn);
}

export function useTransferService(storage: IStorage): TransferServiceManager {
  if (!_instance) {
    const services: ITransferService[] = [];

    // TODO: re-enable SideShift when ready
    // services.push(new SideshiftTransferService(storage, 'uYB9AagC9'));
    if (process.env.EXPO_PUBLIC_GARDEN_APP_ID) {
      services.push(new GardenTransferService(storage, process.env.EXPO_PUBLIC_GARDEN_APP_ID));
    } else {
      console.warn('EXPO_PUBLIC_GARDEN_APP_ID not set — Garden Finance disabled');
    }
    services.push(new SymbiosisTransferService(storage));
    services.push(new FlashnetTransferService(storage, () => SparkWallet.getLastSDKWallet()));
    _nativeDepositService = new NativeDepositTransferService(storage);
    services.push(_nativeDepositService);
    services.push(new FakeTransferService());

    _instance = new TransferServiceManager(services);
  }
  return _instance;
}
