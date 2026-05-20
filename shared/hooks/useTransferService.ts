import { SparkWallet } from '../class/wallets/spark-wallet';
import { FakeTransferService } from '../services/transfer-service-fake';
import { FlashnetTransferService } from '../services/transfer-service-flashnet';
import { GardenTransferService } from '../services/transfer-service-garden';
import { TransferServiceManager } from '../services/transfer-service-manager';
import { NativeDepositClaimExecutor, NativeDepositSwapsFetcher, NativeDepositTransferService } from '../services/transfer-service-native-deposit';
import { SideshiftTransferService } from '../services/transfer-service-sideshift';
import { SparkExitTransferService } from '../services/transfer-service-spark-exit';
import { SymbiosisTransferService } from '../services/transfer-service-symbiosis';
import { IStorage } from '../types/IStorage';
import { ITransferService } from '../types/transfer';

let _instance: TransferServiceManager | undefined;
let _nativeDepositService: NativeDepositTransferService | undefined;
let _flashnetService: FlashnetTransferService | undefined;
let _sparkExitService: SparkExitTransferService | undefined;

export function setNativeDepositSwapsFetcher(fn: NativeDepositSwapsFetcher): void {
  _nativeDepositService?.setSwapsFetcher(fn);
}

export function setNativeDepositClaimExecutor(fn: NativeDepositClaimExecutor): void {
  _nativeDepositService?.setClaimExecutor(fn);
}

export function startAutoClaimMonitor(): void {
  _nativeDepositService?.startAutoClaimMonitor();
}

export function stopAutoClaimMonitor(): void {
  _nativeDepositService?.stopAutoClaimMonitor();
}

export function processAutoClaimsNow(): void {
  _nativeDepositService?.processAutoClaims().catch(() => {});
}

export function setFlashnetAccountNumber(accountNumber: number): void {
  _flashnetService?.setCurrentAccountNumber(accountNumber);
}

export function setSparkExitAccountNumber(accountNumber: number): void {
  _sparkExitService?.setCurrentAccountNumber(accountNumber);
}

/** Returns the singleton TransferServiceManager if it's been constructed yet. Module-level singleton; MCP and other non-hook callers should use this after the app boot has run `useTransferService`. */
export function getTransferServiceManager(): TransferServiceManager | undefined {
  return _instance;
}

export function useTransferService(storage: IStorage): TransferServiceManager {
  if (!_instance) {
    const services: ITransferService[] = [];

    services.push(new SideshiftTransferService(storage, 'uYB9AagC9'));
    if (process.env.EXPO_PUBLIC_GARDEN_APP_ID) {
      services.push(new GardenTransferService(storage, process.env.EXPO_PUBLIC_GARDEN_APP_ID));
    } else {
      console.warn('EXPO_PUBLIC_GARDEN_APP_ID not set — Garden Finance disabled');
    }
    services.push(new SymbiosisTransferService(storage));
    _flashnetService = new FlashnetTransferService(storage, (accountNumber) => SparkWallet.getSDKWalletForAccount(accountNumber));
    services.push(_flashnetService);
    _sparkExitService = new SparkExitTransferService(storage, (accountNumber) => SparkWallet.getSDKWalletForAccount(accountNumber));
    services.push(_sparkExitService);
    _nativeDepositService = new NativeDepositTransferService(storage);
    services.push(_nativeDepositService);
    services.push(new FakeTransferService());

    _instance = new TransferServiceManager(services);
    _nativeDepositService.onTransferCompleted = (execution) => {
      _instance?.onTransferCompleted?.(execution);
    };
  }
  return _instance;
}
