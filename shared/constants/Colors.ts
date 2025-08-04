import {
  NETWORK_ARK_MUTINYNET,
  NETWORK_BITCOIN,
  NETWORK_BOTANIX,
  NETWORK_BOTANIX_TESTNET,
  NETWORK_CITREA_TESTNET,
  NETWORK_LIQUID,
  NETWORK_LIQUID_TESTNET,
  NETWORK_ROOTSTOCK,
  NETWORK_ALPEN_TESTNET,
} from '../types/networks';

const primaryColor = '#011474';
const accent1 = '#FD5D2B';
const accent2 = '#9DF9EC';
const accent3 = '#D9FD5F';
const accent4 = '#F5B9CD';
const neutral = '#CECDCD';

export const gradients = {
  gradient1: [accent1, accent2] as const,
  gradient2: [accent3, accent4] as const,
  blueGradient: ['#01125f', '#0e2589'] as const,
  base: ['#01125F', '#0E2589'] as const,
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
    buttonPrimary: '#000000',
    buttonSecondary: 'transparent',
    buttonBorder: '#FFFFFF1A',
    buttonText: '#FFFFFF',
    paragraphText: '#B8B8B8',
  },
};

export const getNetworkIcon = (network: string): any => {
  switch (network) {
    case NETWORK_BITCOIN:
      return 'logo-bitcoin';
    case NETWORK_LIQUID:
    case NETWORK_LIQUID_TESTNET:
      return 'flash';
    case NETWORK_ROOTSTOCK:
      return 'cube';
    case NETWORK_BOTANIX:
    case NETWORK_BOTANIX_TESTNET:
      return 'leaf';
    case NETWORK_ALPEN_TESTNET:
      return 'layers';
    case NETWORK_CITREA_TESTNET:
      return 'diamond';
    case NETWORK_ARK_MUTINYNET:
      return 'boat';
    default:
      return 'globe';
  }
};

export const getNetworkGradient = (network: string) => {
  const primaryColor = '#011474';
  const accent1 = '#FD5D2B';
  const accent2 = '#9DF9EC';
  const accent3 = '#D9FD5F';
  const accent4 = '#F5B9CD';
  const neutral = '#CECDCD';

  switch (network) {
    case NETWORK_BITCOIN:
      return [accent1, '#FF8C00'];
    case NETWORK_LIQUID:
    case NETWORK_LIQUID_TESTNET:
      return [accent3, accent1];
    case NETWORK_ROOTSTOCK:
      return [primaryColor, '#4E9FFF'];
    case NETWORK_BOTANIX:
    case NETWORK_BOTANIX_TESTNET:
      return [accent2, '#96BEDC'];
    case NETWORK_ALPEN_TESTNET:
      return [accent4, '#A855F7'];
    case NETWORK_CITREA_TESTNET:
      return [accent1, '#FF6B8A'];
    case NETWORK_ARK_MUTINYNET:
      return [primaryColor, '#4285F4'];
    default:
      return [neutral, '#9CA3AF'];
  }
};
