import {
  NETWORK_BITCOIN,
  NETWORK_LIQUID,
  NETWORK_LIQUIDTESTNET,
  NETWORK_ROOTSTOCK,
  NETWORK_BOTANIX,
  NETWORK_BOTANIXTESTNET,
  NETWORK_STRATADEVNET,
  NETWORK_ARKMUTINYNET,
  NETWORK_CITREATESTNET,
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
    case NETWORK_LIQUIDTESTNET:
      return require('../assets/images/ui/network/liquid.png');
    case NETWORK_ROOTSTOCK:
      return require('../assets/images/ui/network/rootstock.png');
    case NETWORK_BOTANIX:
    case NETWORK_BOTANIXTESTNET:
      return require('../assets/images/ui/network/botanix.png');
    case NETWORK_STRATADEVNET:
      return require('../assets/images/ui/network/strata.png');
    case NETWORK_ARKMUTINYNET:
      return require('../assets/images/ui/network/ark.png');
    case NETWORK_CITREATESTNET:
      // TODO: Add citrea.png icon file to assets/images/ui/network/
      return null;
    default:
      return null;
  }
};
