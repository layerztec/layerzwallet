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

const primaryColor = '#011474';
const accent1 = '#FD5D2B';
const accent2 = '#9DF9EC';
const accent3 = '#D9FD5F';
const accent4 = '#F5B9CD';
const neutral = '#CECDCD';
const globalDarkBackground = '#000000';

export const gradients = {
  gradient1: [accent1, accent2] as const,
  gradient2: [accent3, accent4] as const,
  blueGradient: ['#01125f', '#0e2589'] as const,
  base: ['#01125F', '#0E2589'] as const,

  // Network-specific gradients based on the UI design
  [NETWORK_BITCOIN]: ['#0B1F6B', '#1E3A8A'] as const, // Dark blue to blue
  [NETWORK_LIQUID]: ['#0C2E37', '#104140'] as const, // Teal gradient
  [NETWORK_LIQUID_TESTNET]: ['#0C2E37', '#104140'] as const, // Same as liquid
  [NETWORK_ROOTSTOCK]: ['#166534', '#22C55E'] as const, // Dark green to green
  [NETWORK_BOTANIX]: ['#36360B', '#787600'] as const, // Brown to yellow/gold
  [NETWORK_BOTANIX_TESTNET]: ['#36360B', '#787600'] as const, // Same as botanix
  [NETWORK_ALPEN_TESTNET]: ['#7C2D12', '#EA580C'] as const, // Dark orange to orange
  [NETWORK_CITREA_TESTNET]: ['#EF8F36', '#EB582A'] as const, // Orange/red gradient
  [NETWORK_CITREA]: ['#EF8F36', '#EB582A'] as const, // Orange/red gradient
  [NETWORK_ARK]: ['#270A7B', '#391998'] as const, // Dark purple gradient
  [NETWORK_ARK_MUTINYNET]: ['#270A7B', '#391998'] as const, // Dark purple gradient
  [NETWORK_LIGHTNING]: ['#581C87', '#7C3AED'] as const, // Purple gradient
  [NETWORK_LIGHTNING_TESTNET]: ['#581C87', '#7C3AED'] as const, // Purple gradient
  [NETWORK_USDT]: ['#058787', '#22AAAA'] as const,
  [NETWORK_SPARK]: ['#05161D', '#1E242E'] as const, // Light gray gradient
  [NETWORK_STACKS]: ['#7C2D12', '#fc6432'] as const, // orange
};

export const Colors = {
  light: {
    text: '#ebebeb',
    background: '#fff',
    tint: primaryColor,
    icon: accent1,
    tabIconDefault: neutral,
    tabIconSelected: accent1,
    buttonPrimary: primaryColor,
    buttonSecondary: 'transparent',
    buttonBorder: '#FFFFFF1A',
    buttonText: '#FFFFFF',
    paragraphText: '#B8B8B8',
  },
  dark: {
    text: 'grey', // Change to #FFFFFF later to match Figma. Currently using 'grey' for visibility in dark mode and e2e testing.
    background: primaryColor,
    tint: primaryColor,
    icon: accent1,
    tabIconDefault: neutral,
    tabIconSelected: accent1,
    buttonPrimary: 'rgba(255, 255, 255, 0.3)',
    buttonSecondary: 'transparent',
    buttonBorder: '#FFFFFF1A',
    buttonText: '#FFFFFF',
    paragraphText: '#B8B8B8',
  },
  GlobalDarkBackground: globalDarkBackground,
};

export const getNetworkGradient = (network: string) => {
  switch (network) {
    case NETWORK_BITCOIN:
      return ['#0B1F6B', '#1E3A8A']; // Dark blue to blue
    case NETWORK_LIQUID:
    case NETWORK_LIQUID_TESTNET:
      return ['#0C2E37', '#104140']; // Teal gradient
    case NETWORK_ROOTSTOCK:
      return ['#166534', '#22C55E']; // Dark green to green
    case NETWORK_BOTANIX:
    case NETWORK_BOTANIX_TESTNET:
      return ['#36360B', '#787600']; // Brown to yellow/gold
    case NETWORK_ALPEN_TESTNET:
      return ['#7C2D12', '#EA580C']; // Dark orange to orange
    case NETWORK_CITREA:
    case NETWORK_CITREA_TESTNET:
      return ['#EF8F36', '#EB582A']; // Orange/red gradient
    case NETWORK_ARK_MUTINYNET:
      return ['#270A7B', '#391998']; // Dark purple gradient
    case NETWORK_ARK:
      return ['#270A7B', '#391998']; // Dark purple gradient
    case NETWORK_LIGHTNING:
    case NETWORK_LIGHTNING_TESTNET:
      return ['#581C87', '#7C3AED']; // Purple gradient
    case NETWORK_USDT:
      return ['#058787', '#22AAAA']; // Teal gradient
    default:
      return ['#6B7280', '#9CA3AF']; // Light gray gradient for unknown networks
  }
};
