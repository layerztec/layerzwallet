export const NETWORK_BITCOIN = 'bitcoin' as const;
export const NETWORK_SEPOLIA = 'sepolia' as const;
export const NETWORK_ROOTSTOCK = 'rootstock' as const;
export const NETWORK_ALPEN_TESTNET = 'alpen_testnet' as const;
export const NETWORK_CITREA = 'citrea' as const;
export const NETWORK_CITREA_TESTNET = 'citrea_testnet' as const;
export const NETWORK_ARK_MUTINYNET = 'ark_mutinynet' as const;
export const NETWORK_ARK = 'arkade' as const;
export const NETWORK_LIQUID = 'liquid' as const;
export const NETWORK_LIQUID_TESTNET = 'liquid_testnet' as const;
export const NETWORK_SPARK = 'spark' as const;
export const NETWORK_LIGHTNING = 'lightning' as const;
export const NETWORK_LIGHTNING_TESTNET = 'lightning_testnet' as const;
export const NETWORK_USDT = 'USDT' as const;
export const NETWORK_STACKS = 'stacks' as const;

const NetworksIterator = {
  BITCOIN: NETWORK_BITCOIN,
  SEPOLIA: NETWORK_SEPOLIA,
  ROOTSTOCK: NETWORK_ROOTSTOCK,
  ALPEN_TESTNET: NETWORK_ALPEN_TESTNET,
  CITREA: NETWORK_CITREA,
  CITREA_TESTNET: NETWORK_CITREA_TESTNET,
  ARK_MUTINYNET: NETWORK_ARK_MUTINYNET,
  ARK: NETWORK_ARK,
  LIQUID: NETWORK_LIQUID,
  LIQUID_TESTNET: NETWORK_LIQUID_TESTNET,
  SPARK: NETWORK_SPARK,
  LIGHTNING: NETWORK_LIGHTNING,
  LIGHTNING_TESTNET: NETWORK_LIGHTNING_TESTNET,
  USDT: NETWORK_USDT,
  STACKS: NETWORK_STACKS,
} as const;

export type Networks = (typeof NetworksIterator)[keyof typeof NetworksIterator];

export const getAvailableNetworks = (): Networks[] => {
  return Object.values(NetworksIterator).filter((network) => network !== NETWORK_SEPOLIA);
};
