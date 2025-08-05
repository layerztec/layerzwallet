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
} from '@shared/types/networks';

/**
 * Gets the image asset for a given network
 * @param network The network identifier
 * @returns The require() statement for the network image or null if not found
 */
export const getNetworkImageAsset = (network: string) => {
  switch (network) {
    case NETWORK_BITCOIN:
      return require('../assets/images/ui/network/bitcoin.png');
    case NETWORK_LIQUID:
    case NETWORK_LIQUID_TESTNET:
      return require('../assets/images/ui/network/liquid.png');
    case NETWORK_ROOTSTOCK:
      return require('../assets/images/ui/network/rootstock.png');
    case NETWORK_BOTANIX:
    case NETWORK_BOTANIX_TESTNET:
      return require('../assets/images/ui/network/botanix.png');
    case NETWORK_ALPEN_TESTNET:
      return require('../assets/images/ui/network/strata.png');
    case NETWORK_ARK_MUTINYNET:
      return require('../assets/images/ui/network/ark.png');
    case NETWORK_CITREA_TESTNET:
      // TODO: Add citrea.png icon file to assets/images/ui/network/
      return null;
    default:
      return null;
  }
};
