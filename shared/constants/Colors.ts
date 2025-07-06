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

const brandPrimary = '#011474';
const accentPrimary = '#FD5D2B';
const accentSecondary = '#9DF9EC';
const accentTertiary = '#D9FD5F';
const accentQuaternary = '#F5B9CD';
const gray = '#CECDCD';

export const gradients = {
  gradient1: [accentPrimary, accentSecondary],
  gradient2: [accentTertiary, accentQuaternary],
  // Welcome screen gradients
  welcomeBackground: ['#1a1a4a', '#4a2c7a', '#8b4a7a', '#d4556a', '#ff6b5a'],
  welcomeBottomOverlay: ['#00007D', 'rgba(0, 0, 125, 0)'],
  welcomeButton: ['#85F8E8', '#FC602C'],
};

export const welcomeColors = {
  background: brandPrimary,
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.7)',
  buttonText: '#000000',
  borderWhite: '#FFFFFF',
  textureOverlay: 'rgba(255, 255, 255, 0.7)',
};

export const Colors = {
  light: {
    text: brandPrimary,
    background: '#fff',
    tint: brandPrimary,
    icon: accentPrimary,
    tabIconDefault: gray,
    tabIconSelected: accentPrimary,
  },
  dark: {
    text: brandPrimary,
    background: '#fff',
    tint: brandPrimary,
    icon: accentPrimary,
    tabIconDefault: gray,
    tabIconSelected: accentPrimary,
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
  switch (network) {
    case NETWORK_BITCOIN:
      return [accentPrimary, '#FF8C00'];
    case NETWORK_LIQUID:
    case NETWORK_LIQUIDTESTNET:
      return [accentTertiary, accentPrimary];
    case NETWORK_ROOTSTOCK:
      return [brandPrimary, '#4E9FFF'];
    case NETWORK_BOTANIX:
    case NETWORK_BOTANIXTESTNET:
      return [accentSecondary, '#96BEDC'];
    case NETWORK_STRATADEVNET:
      return [accentQuaternary, '#A855F7'];
    case NETWORK_CITREATESTNET:
      return [accentPrimary, '#FF6B8A'];
    case NETWORK_ARKMUTINYNET:
      return [brandPrimary, '#4285F4'];
    default:
      return [gray, '#9CA3AF'];
  }
};
