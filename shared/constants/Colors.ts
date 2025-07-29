import {
  NETWORK_ARKMUTINYNET,
  NETWORK_BITCOIN,
  NETWORK_BOTANIX,
  NETWORK_BOTANIXTESTNET,
  NETWORK_CITREATESTNET,
  NETWORK_LIQUID,
  NETWORK_LIQUIDTESTNET,
  NETWORK_ROOTSTOCK,
  NETWORK_STRATADEVNET,
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
  rootstock: ['#034628', '#026B3C'] as const,
  botanix: ['#60490F', '#745A13'] as const,
  citrea: ['#6B2911', '#8B3A03'] as const,
  strata: ['#40126B', '#56168A'] as const,
  liquid: ['#00474E', '#006C55'] as const,
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
    error: '#FF6B6B',
    white30: 'rgba(255, 255, 255, 0.3)',
    white50: 'rgba(255, 255, 255, 0.5)',
    white90: 'rgba(255, 255, 255, 0.9)',
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
    error: '#FF6B6B',
    white30: 'rgba(255, 255, 255, 0.3)',
    white50: 'rgba(255, 255, 255, 0.5)',
    white90: 'rgba(255, 255, 255, 0.9)',
  },
};

export const getNetworkIcon = (network: string): any => {
  switch (network) {
    case NETWORK_BITCOIN:
      return 'logo-bitcoin';
    case NETWORK_LIQUID:
    case NETWORK_LIQUIDTESTNET:
      return 'flash';
    case NETWORK_ROOTSTOCK:
      return 'cube';
    case NETWORK_BOTANIX:
    case NETWORK_BOTANIXTESTNET:
      return 'leaf';
    case NETWORK_STRATADEVNET:
      return 'layers';
    case NETWORK_CITREATESTNET:
      return 'diamond';
    case NETWORK_ARKMUTINYNET:
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
    case NETWORK_LIQUIDTESTNET:
      return [accent3, accent1];
    case NETWORK_ROOTSTOCK:
      return [primaryColor, '#4E9FFF'];
    case NETWORK_BOTANIX:
    case NETWORK_BOTANIXTESTNET:
      return [accent2, '#96BEDC'];
    case NETWORK_STRATADEVNET:
      return [accent4, '#A855F7'];
    case NETWORK_CITREATESTNET:
      return [accent1, '#FF6B8A'];
    case NETWORK_ARKMUTINYNET:
      return [primaryColor, '#4285F4'];
    default:
      return [neutral, '#9CA3AF'];
  }
};
