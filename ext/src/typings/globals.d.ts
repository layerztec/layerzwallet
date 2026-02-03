import { IBreezAdapter } from '@shared/class/wallets/breez-wallet';
import { IRGBAdapter } from '@shared/class/wallets/rgb-wallet';
import { ISparkAdapter } from '@shared/class/wallets/spark-wallet';

declare function alert(message: string): void;

declare global {
  var breezAdapter: IBreezAdapter;
  var rgbAdapter: IRGBAdapter;
  var sparkAdapter: ISparkAdapter;
  var handleError: ((error: unknown, context?: string) => void | Promise<void>) | undefined;
}
