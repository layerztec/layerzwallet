import { ReactNativeSparkSigner, SparkWallet as NativeSDK } from '@buildonspark/spark-sdk/native';
import { ISparkAdapter } from '@shared/class/wallets/spark-wallet';

class SparkAdapter implements ISparkAdapter {
  initialize(...args: Parameters<ISparkAdapter['initialize']>) {
    const sparkWalletProps = args[0];
    return NativeSDK.initialize({
      // @ts-ignore some types incompatibility between regular signer and RN signer
      signer: new ReactNativeSparkSigner(),
      ...sparkWalletProps,
    }) as unknown as ReturnType<ISparkAdapter['initialize']>;
  }
}

global.sparkAdapter = new SparkAdapter();
