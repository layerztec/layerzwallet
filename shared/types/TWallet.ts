import { BreezWallet } from '../class/wallets/breez-wallet';
import { SparkWallet } from '../class/wallets/spark-wallet';
import { ArkWallet } from '../class/wallets/ark-wallet';
import { EvmWallet } from '../class/evm-wallet';
import { HDSegwitBech32Wallet } from '../class/wallets/hd-segwit-bech32-wallet';

export type TWallet = BreezWallet | SparkWallet | ArkWallet | HDSegwitBech32Wallet | EvmWallet;
export type TLightningWallet = BreezWallet | SparkWallet;
