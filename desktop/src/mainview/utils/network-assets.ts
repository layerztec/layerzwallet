import {
  NETWORK_ALPEN_TESTNET,
  NETWORK_BITCOIN,
  NETWORK_CITREA,
  NETWORK_CITREA_TESTNET,
  NETWORK_LIGHTNING,
  NETWORK_LIGHTNING_TESTNET,
  NETWORK_LIQUID,
  NETWORK_LIQUID_TESTNET,
  NETWORK_ROOTSTOCK,
  NETWORK_SPARK,
  NETWORK_STACKS,
  NETWORK_USDT,
  Networks,
} from '@shared/types/networks';

import alpenIcon from '../../../../mobile/assets/images/ui/network/alpen.png';
import bitcoinIcon from '../../../../mobile/assets/images/ui/network/bitcoin.png';
import citreaIcon from '../../../../mobile/assets/images/ui/network/citrea.png';
import lightningIcon from '../../../../mobile/assets/images/ui/network/lightning.png';
import liquidIcon from '../../../../mobile/assets/images/ui/network/liquid.png';
import rootstockIcon from '../../../../mobile/assets/images/ui/network/rootstock.png';
import sparkIcon from '../../../../mobile/assets/images/ui/network/spark.png';
import stacksIcon from '../../../../mobile/assets/images/ui/network/stacks.png';
import tetherIcon from '../../../../mobile/assets/images/ui/network/tether.png';

const networkImages: Partial<Record<Networks, string>> = {
  [NETWORK_BITCOIN]: bitcoinIcon,
  [NETWORK_LIGHTNING]: lightningIcon,
  [NETWORK_LIGHTNING_TESTNET]: lightningIcon,
  [NETWORK_SPARK]: sparkIcon,
  [NETWORK_LIQUID]: liquidIcon,
  [NETWORK_LIQUID_TESTNET]: liquidIcon,
  [NETWORK_ROOTSTOCK]: rootstockIcon,
  [NETWORK_ALPEN_TESTNET]: alpenIcon,
  [NETWORK_CITREA]: citreaIcon,
  [NETWORK_CITREA_TESTNET]: citreaIcon,
  [NETWORK_USDT]: tetherIcon,
  [NETWORK_STACKS]: stacksIcon,
};

export function getNetworkImageUrl(network: Networks): string | null {
  return networkImages[network] ?? null;
}
