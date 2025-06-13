export const NETWORK_BITCOIN = 'bitcoin' as const;
export const NETWORK_SEPOLIA = 'sepolia' as const;
export const NETWORK_ROOTSTOCK = 'rootstock' as const;
export const NETWORK_BOTANIXTESTNET = 'botanix' as const;
export const NETWORK_STRATADEVNET = 'strata' as const;
export const NETWORK_CITREATESTNET = 'citrea' as const;
export const NETWORK_ARKMUTINYNET = 'ark' as const;
export const NETWORK_BREEZ = 'breez' as const;
export const NETWORK_BREEZTESTNET = 'breeztest' as const;
export const NETWORK_SPARK = 'spark' as const;

const NetworksIterator = {
  BITCOIN: NETWORK_BITCOIN,
  SEPOLIA: NETWORK_SEPOLIA,
  ROOTSTOCK: NETWORK_ROOTSTOCK,
  BOTANIXTESTNET: NETWORK_BOTANIXTESTNET,
  STRATADEVNET: NETWORK_STRATADEVNET,
  CITREATESTNET: NETWORK_CITREATESTNET,
  ARKMUTINYNET: NETWORK_ARKMUTINYNET,
  BREEZ: NETWORK_BREEZ,
  BREEZTESTNET: NETWORK_BREEZTESTNET,
  SPARK: NETWORK_SPARK,
} as const;

export type Networks = (typeof NetworksIterator)[keyof typeof NetworksIterator];

export const getAvailableNetworks = (): Networks[] => {
  return Object.values(NetworksIterator).filter((network) => network !== NETWORK_SEPOLIA);
};
