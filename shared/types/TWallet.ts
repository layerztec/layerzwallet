import { BreezWallet } from '../class/wallets/breez-wallet';
import { SparkWallet } from '../class/wallets/spark-wallet';
import { ArkWallet } from '../class/wallets/ark-wallet';
import { EvmWallet } from '../class/evm-wallet';
import { WatchOnlyWallet } from '@shared/class/wallets/watch-only-wallet';

export type TWallet = BreezWallet | SparkWallet | ArkWallet | WatchOnlyWallet | EvmWallet;
export type TLightningWallet = BreezWallet | SparkWallet | ArkWallet;
