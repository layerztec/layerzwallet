const primaryColor = '#011474';
const accent1 = '#FD5D2B';
const accent2 = '#9DF9EC';
const accent3 = '#D9FD5F';
const accent4 = '#F5B9CD';
const neutral = '#CECDCD';

export const gradients = {
  gradient1: [accent1, accent2],
  gradient2: [accent3, accent4],
};

export const Colors = {
  light: {
    text: primaryColor,
    background: '#fff',
    tint: primaryColor,
    icon: accent1,
    tabIconDefault: neutral,
    tabIconSelected: accent1,
  },
  dark: {
    text: primaryColor,
    background: '#fff',
    tint: primaryColor,
    icon: accent1,
    tabIconDefault: neutral,
    tabIconSelected: accent1,
  },
};

export const getNetworkIcon = (network: string): any => {
  switch (network) {
    case 'bitcoin':
      return 'logo-bitcoin';
    case 'breez':
    case 'breeztestnet':
    case 'breeztest':
      return 'flash';
    case 'rootstock':
      return 'cube';
    case 'botanix':
      return 'leaf';
    case 'strata':
      return 'layers';
    case 'citrea':
      return 'diamond';
    case 'ark':
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
    case 'bitcoin':
      return [accent1, '#FF8C00'];
    case 'breez':
    case 'breeztestnet':
    case 'breeztest':
      return [accent3, accent1];
    case 'rootstock':
      return [primaryColor, '#4E9FFF'];
    case 'botanix':
      return [accent2, '#96BEDC'];
    case 'strata':
      return [accent4, '#A855F7'];
    case 'citrea':
      return [accent1, '#FF6B8A'];
    case 'ark':
      return [primaryColor, '#4285F4'];
    default:
      return [neutral, '#9CA3AF'];
  }
};
