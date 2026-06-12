import { SparkWallet as SDK } from '@buildonspark/spark-sdk';
import { ISparkAdapter } from '@shared/class/wallets/spark-wallet';

class SparkAdapter implements ISparkAdapter {
  async initialize(...args: Parameters<ISparkAdapter['initialize']>) {
    const sparkWalletProps = args[0];
    return await SDK.initialize(sparkWalletProps);
  }
}

globalThis.sparkAdapter = new SparkAdapter();
