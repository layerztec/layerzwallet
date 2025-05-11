import { createTamagui, createFont, createTokens } from 'tamagui';

// Define our font family with weights
const interFont = createFont({
  family: 'Inter',
  size: {
    1: 12,
    2: 14,
    3: 16,
    4: 20,
    5: 24,
    6: 32,
  },
  lineHeight: {
    1: 16,
    2: 20,
    3: 24,
    4: 28,
    5: 32,
    6: 40,
  },
  weight: {
    light: '300',
    regular: '400',
    medium: '500',
    bold: '700',
    black: '900',
  },
  letterSpacing: {
    1: 0,
    2: 0.05,
    3: 0.1,
    4: 0.2,
  },
  face: {
    300: { normal: 'Inter-Light' },
    400: { normal: 'Inter-Regular' },
    500: { normal: 'Inter-Medium' },
    700: { normal: 'Inter-Bold' },
    900: { normal: 'Inter-Black' },
  },
});

// Define color tokens based on your current color scheme
const tokens = createTokens({
  color: {
    primary: '#011474',
    accent1: '#FD5D2B',
    accent2: '#9DF9EC',
    accent3: '#D9FD5F',
    accent4: '#F5B9CD',
    neutral: '#CECDCD',
    background: {
      light: '#FFFFFF',
      dark: '#011474',
    },
    text: {
      light: '#011474',
      dark: '#FFFFFF',
    },
  },
  space: {
    0: 0,
    1: 4,
    2: 8,
    3: 16,
    4: 24,
    5: 32,
    6: 40,
  },
  radius: {
    0: 0,
    1: 4,
    2: 8,
    3: 16,
    4: 24,
    5: 32,
  },
  zIndex: {
    0: 0,
    1: 100,
    2: 200,
    3: 300,
    4: 400,
    5: 500,
  },
});

// Create the Tamagui config
export const tamaguiConfig = createTamagui({
  fonts: {
    heading: interFont,
    body: interFont,
  },
  tokens,
  themes: {
    light: {
      background: tokens.color.background.light,
      text: tokens.color.text.light,
    },
    dark: {
      background: tokens.color.background.dark,
      text: tokens.color.text.dark,
    },
  },
});

// Export types
export type AppConfig = typeof tamaguiConfig;
declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}
