import {
  NETWORK_ARK,
  NETWORK_ARK_MUTINYNET,
  NETWORK_BITCOIN,
  NETWORK_BOTANIX,
  NETWORK_BOTANIX_TESTNET,
  NETWORK_CITREA,
  NETWORK_CITREA_TESTNET,
  NETWORK_LIQUID,
  NETWORK_LIQUID_TESTNET,
  NETWORK_ROOTSTOCK,
  NETWORK_ALPEN_TESTNET,
  NETWORK_USDT,
  NETWORK_LIGHTNING,
  NETWORK_LIGHTNING_TESTNET,
  NETWORK_SPARK,
  NETWORK_STACKS,
} from '../types/networks';

const neutral = '#CECDCD';
export const globalDarkBackground = '#000000';
export const overlayBackground = 'rgba(255, 255, 255, 0.1)';
export const overlayBackgroundDeeper = 'rgba(255, 255, 255, 0.05)';

/**
 * Network color definitions - each network has a primary and secondary color
 * - Cards use: [primary, secondary] for linear gradients
 */
export const networkColors: Record<string, { primary: string; secondary: string }> = {
  base: { primary: '#01125F', secondary: '#0E2589' },
  [NETWORK_BITCOIN]: { primary: '#0A6FDB', secondary: '#1883F5' },
  [NETWORK_LIQUID]: { primary: '#0C2E37', secondary: '#104140' },
  [NETWORK_LIQUID_TESTNET]: { primary: '#0C2E37', secondary: '#104140' },
  [NETWORK_ROOTSTOCK]: { primary: '#166534', secondary: '#22C55E' },
  [NETWORK_BOTANIX]: { primary: '#36360B', secondary: '#787600' },
  [NETWORK_BOTANIX_TESTNET]: { primary: '#36360B', secondary: '#787600' },
  [NETWORK_ALPEN_TESTNET]: { primary: '#7C2D12', secondary: '#EA580C' },
  [NETWORK_CITREA]: { primary: '#AF4904', secondary: '#CD5A0C' },
  [NETWORK_CITREA_TESTNET]: { primary: '#AF4904', secondary: '#CD5A0C' },
  [NETWORK_ARK]: { primary: '#270A7B', secondary: '#391998' },
  [NETWORK_ARK_MUTINYNET]: { primary: '#270A7B', secondary: '#391998' },
  [NETWORK_LIGHTNING]: { primary: '#581C87', secondary: '#7C3AED' },
  [NETWORK_LIGHTNING_TESTNET]: { primary: '#581C87', secondary: '#7C3AED' },
  [NETWORK_USDT]: { primary: '#058787', secondary: '#22AAAA' },
  [NETWORK_SPARK]: { primary: '#607E8A', secondary: '#7297A6' },
  [NETWORK_STACKS]: { primary: '#7C2D12', secondary: '#fc6432' },
};

export const Colors = {
  light: {
    text: '#ebebeb',
    background: '#fff',
    tint: '#011474',
    icon: '#FD5D2B',
    tabIconDefault: neutral,
    tabIconSelected: '#FD5D2B',
    buttonPrimary: '#011474',
    buttonSecondary: 'transparent',
    buttonBorder: '#FFFFFF1A',
    buttonText: '#FFFFFF',
    paragraphText: '#B8B8B8',
  },
  dark: {
    text: 'grey', // Change to #FFFFFF later to match Figma. Currently using 'grey' for visibility in dark mode and e2e testing.
    background: globalDarkBackground,
    tint: '#FFFFFF',
    icon: '#FD5D2B',
    tabIconDefault: neutral,
    tabIconSelected: '#FD5D2B',
    buttonPrimary: 'rgba(255, 255, 255, 0.3)',
    buttonSecondary: 'transparent',
    buttonBorder: '#FFFFFF1A',
    buttonText: '#FFFFFF',
    paragraphText: '#B8B8B8',
  },
  GlobalDarkBackground: globalDarkBackground,
};

/**
 * Get network gradient colors for cards [primary, secondary]
 */
export const getNetworkGradient = (network: string): [string, string] => {
  const colors = networkColors[network] || networkColors.base;
  return [colors.primary, colors.secondary];
};

/**
 * Get the primary color for a network (used for radial gradients: primary → black)
 */
export const getNetworkPrimaryColor = (network: string): string => {
  return networkColors[network]?.primary || networkColors.base.primary;
};

/**
 * Gradients export - derived from networkColors for backward compatibility
 */
export const gradients = Object.fromEntries(Object.entries(networkColors).map(([key, colors]) => [key, [colors.primary, colors.secondary] as const])) as Record<string, readonly [string, string]>;
