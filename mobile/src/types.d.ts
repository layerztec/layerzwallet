import { IBreezAdapter } from '@shared/class/wallets/breez-wallet';
import { ISparkAdapter } from '@shared/class/wallets/spark-wallet';

declare global {
  // eslint-disable-next-line no-var
  var breezAdapter: IBreezAdapter;
  // eslint-disable-next-line no-var
  var sparkAdapter: ISparkAdapter;
}
