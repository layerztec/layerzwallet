import { IBreezAdapter } from '@shared/class/wallets/breez-wallet';
import { ISparkAdapter } from '@shared/class/wallets/spark-wallet';
import { IRGBAdapter } from '@shared/class/wallets/rgb-wallet';

declare global {
  var breezAdapter: IBreezAdapter;
  var sparkAdapter: ISparkAdapter;
  var rgbAdapter: IRGBAdapter;
  var handleError: ((error: unknown, context?: string) => void | Promise<void>) | undefined;
}
