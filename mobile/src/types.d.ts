import { IBreezAdapter } from '@shared/class/wallets/breez-wallet';
import { ISparkAdapter } from '@shared/class/wallets/spark-wallet';
import { IRgbAdapter } from '@shared/types/rgb-adapter';

/* eslint-disable no-var */

declare global {
  var breezAdapter: IBreezAdapter;

  var sparkAdapter: ISparkAdapter;

  var rgbAdapter: IRgbAdapter;

  var handleError: ((error: unknown, context?: string) => void | Promise<void>) | undefined;
}
