export const NETWORK_BITCOIN = 'bitcoin' as const;
export const NETWORK_SEPOLIA = 'sepolia' as const;
export const NETWORK_ROOTSTOCK = 'rootstock' as const;
export const NETWORK_BOTANIX = 'botanix' as const;
export const NETWORK_BOTANIXTESTNET = 'botanixtest' as const;
export const NETWORK_STRATADEVNET = 'strata' as const;
export const NETWORK_CITREATESTNET = 'citrea' as const;
export const NETWORK_ARKMUTINYNET = 'ark' as const;
export const NETWORK_LIQUID = 'liquid' as const;
export const NETWORK_LIQUIDTESTNET = 'liquidtest' as const;
export const NETWORK_SPARK = 'spark' as const;
export const NETWORK_LIGHTNING = 'lightning' as const;
export const NETWORK_LIGHTNINGTESTNET = 'lightningtest' as const;

const NetworksIterator = {
  BITCOIN: NETWORK_BITCOIN,
  SEPOLIA: NETWORK_SEPOLIA,
  ROOTSTOCK: NETWORK_ROOTSTOCK,
  BOTANIX: NETWORK_BOTANIX,
  BOTANIXTESTNET: NETWORK_BOTANIXTESTNET,
  STRATADEVNET: NETWORK_STRATADEVNET,
  CITREATESTNET: NETWORK_CITREATESTNET,
  ARKMUTINYNET: NETWORK_ARKMUTINYNET,
  LIQUID: NETWORK_LIQUID,
  LIQUIDTESTNET: NETWORK_LIQUIDTESTNET,
  SPARK: NETWORK_SPARK,
  LIGHTNING: NETWORK_LIGHTNING,
  LIGHTNINGTESTNET: NETWORK_LIGHTNINGTESTNET,
} as const;

export type Networks = (typeof NetworksIterator)[keyof typeof NetworksIterator];

export const getAvailableNetworks = (): Networks[] => {
  return Object.values(NetworksIterator).filter((network) => network !== NETWORK_SEPOLIA);
};
