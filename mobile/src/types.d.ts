import { IBreezAdapter } from '@shared/class/wallets/breez-wallet';

declare global {
  // eslint-disable-next-line no-var
  var breezAdapter: IBreezAdapter;
}
