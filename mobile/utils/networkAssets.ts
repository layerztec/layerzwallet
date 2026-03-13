import {
  NETWORK_BITCOIN,
  NETWORK_LIQUID,
  NETWORK_LIQUID_TESTNET,
  NETWORK_ROOTSTOCK,
  NETWORK_BOTANIX,
  NETWORK_BOTANIX_TESTNET,
  NETWORK_ALPEN_TESTNET,
  NETWORK_ARK_MUTINYNET,
  NETWORK_CITREA_TESTNET,
  NETWORK_LIGHTNING,
  NETWORK_SPARK,
  NETWORK_LIGHTNING_TESTNET,
  NETWORK_USDT,
  NETWORK_ARK,
  NETWORK_STACKS,
  NETWORK_CITREA,
} from '@shared/types/networks';
import { AssetId } from '@shared/types/asset';
import { SO_LIQUID_USDT, SO_STACKS_STX } from '@shared/types/swap';

/** Brand colors for transfer asset icon backgrounds (used with transparency) */
const TRANSFER_ASSET_COLORS: Partial<Record<AssetId, string>> = {
  'native:bitcoin': '#F7931A',
  'native:citrea': '#F7931A',
  'native:liquid': '#1BA9A4',
  'native:rootstock': '#3FCF54',
  'native:arkade': '#D4A017',
  'native:spark': '#7297A6',
  'token:liquid:usdt': '#26A17B',
  'token:liquid:eurx': '#0052B4',
  'token:stacks:stx': '#5546FF',
};

/**
 * Gets the brand color for a transfer asset icon.
 * Returns a hex color string; caller should apply desired opacity.
 */
export const getTransferAssetColor = (assetId: AssetId): string | undefined => {
  return TRANSFER_ASSET_COLORS[assetId];
};

/**
 * Gets the image asset for a specific transfer asset (coin/token icon).
 * For tokens, returns the token-specific icon. For native coins, returns the network icon.
 */
export const getTransferAssetIcon = (assetId: AssetId, network: string): string | null => {
  switch (assetId) {
    case 'token:liquid:usdt':
      return require('../assets/images/ui/network/tether.png');
    case 'token:stacks:stx':
      return require('../assets/images/ui/network/stacks.png');
    default:
      return getNetworkImageAsset(network);
  }
};

/**
 * Gets the image asset for a given network
 * @param network The network identifier
 * @returns The require() statement for the network image or null if not found
 */
export const getNetworkImageAsset = (network: string): string | null => {
  switch (network) {
    case NETWORK_BITCOIN:
      return require('../assets/images/ui/network/bitcoin.png');
    case NETWORK_LIGHTNING:
    case NETWORK_LIGHTNING_TESTNET:
      return require('../assets/images/ui/network/lightning.png');
    case NETWORK_SPARK:
      return require('../assets/images/ui/network/spark.png');
    case NETWORK_LIQUID:
    case NETWORK_LIQUID_TESTNET:
    case SO_LIQUID_USDT:
      return require('../assets/images/ui/network/liquid.png');
    case SO_STACKS_STX:
      return require('../assets/images/ui/network/stacks.png');
    case NETWORK_ROOTSTOCK:
      return require('../assets/images/ui/network/rootstock.png');
    case NETWORK_BOTANIX:
    case NETWORK_BOTANIX_TESTNET:
      return require('../assets/images/ui/network/botanix.png');
    case NETWORK_ALPEN_TESTNET:
      return require('../assets/images/ui/network/alpen.png');
    case NETWORK_ARK_MUTINYNET:
    case NETWORK_ARK:
      return require('../assets/images/ui/network/ark.png');
    case NETWORK_CITREA:
    case NETWORK_CITREA_TESTNET:
      return require('../assets/images/ui/network/citrea.png');
    case NETWORK_USDT:
      return require('../assets/images/ui/network/tether.png');
    case NETWORK_STACKS:
      return require('../assets/images/ui/network/stacks.png');
    default:
      return null;
  }
};
