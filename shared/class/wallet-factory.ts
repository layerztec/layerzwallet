import { TLightningWallet } from '../types/TWallet';
import { IBackgroundCaller } from '../types/IBackgroundCaller';
import { NETWORK_LIQUID, NETWORK_LIQUIDTESTNET, NETWORK_SPARK, Networks } from '../types/networks';
import { BreezWallet, getBreezNetwork } from '../class/wallets/breez-wallet';
import { SparkWallet } from '../class/wallets/spark-wallet';

export class WalletFactory {
  private static instance: WalletFactory;
  private constructor() {}

  public static getInstance(): WalletFactory {
    if (!WalletFactory.instance) {
      WalletFactory.instance = new WalletFactory();
    }
    return WalletFactory.instance;
  }

  public async getLightningWallet(network: Networks, accountNumber: number, BackgroundCaller: IBackgroundCaller): Promise<TLightningWallet> {
    if (network === NETWORK_LIQUID || network === NETWORK_LIQUIDTESTNET) {
      const subMnemonic = await BackgroundCaller.getSubMnemonic(accountNumber);
      const bNetwork = getBreezNetwork(network);

      return new BreezWallet(subMnemonic, bNetwork);
    }

    if (network === NETWORK_SPARK) {
      const subMnemonic = await BackgroundCaller.getSubMnemonic(accountNumber);

      const w = new SparkWallet();
      w.setSecret(subMnemonic);
      await w.init();
      return w;
    }

    throw new Error(`Lightning wallet on ${network} is not supported`);
  }
}
