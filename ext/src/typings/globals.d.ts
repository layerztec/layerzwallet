import { IBreezAdapter } from '@shared/class/wallets/breez-wallet';

/**
 * PORTED FROM  https://github.com/BlueWallet/BlueWallet/
 * LICENSE: MIT
 */
declare function alert(message: string): void;

declare global {
  var breezAdapter: IBreezAdapter;
}
