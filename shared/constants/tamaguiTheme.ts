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

// Define a simpler token set following Tamagui's structure
const tokens = createTokens({
  // Simplified color tokens
  color: {
    primary: '#011474',
    accent1: '#FD5D2B',
    accent2: '#9DF9EC',
    accent3: '#D9FD5F',
    accent4: '#F5B9CD',
    neutral: '#CECDCD',

    // Define text and background directly, not in nested objects
    background: '#FFFFFF',
    backgroundDark: '#011474',
    text: '#011474',
    textDark: '#FFFFFF',
  },

  // Standard size and space scales - using numbers instead of named tokens
  space: {
    0: 0,
    1: 4,
    2: 8,
    3: 16,
    4: 24,
    5: 32,
    6: 40,
  },

  // Size tokens - these must match space tokens
  size: {
    0: 0,
    1: 4,
    2: 8,
    3: 16,
    4: 24,
    5: 32,
    6: 40,
  },

  // Border radius tokens
  radius: {
    0: 0,
    1: 4,
    2: 8,
    3: 16,
    4: 24,
    5: 32,
  },

  // Z-index tokens
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
  defaultFont: 'body',
  fonts: {
    heading: interFont,
    body: interFont,
  },
  tokens,
  themes: {
    light: {
      background: tokens.color.background,
      text: tokens.color.text,
      color: tokens.color.text,
      borderColor: tokens.color.neutral,
      shadowColor: tokens.color.neutral,
    },
    dark: {
      background: tokens.color.backgroundDark,
      text: tokens.color.textDark,
      color: tokens.color.textDark,
      borderColor: tokens.color.neutral,
      shadowColor: tokens.color.neutral,
    },
  },
  // Add shorthands for size and space
  shorthands: {
    p: 'padding',
    pt: 'paddingTop',
    pr: 'paddingRight',
    pb: 'paddingBottom',
    pl: 'paddingLeft',
    px: 'paddingHorizontal',
    py: 'paddingVertical',
    m: 'margin',
    mt: 'marginTop',
    mr: 'marginRight',
    mb: 'marginBottom',
    ml: 'marginLeft',
    mx: 'marginHorizontal',
    my: 'marginVertical',
    w: 'width',
    h: 'height',
    bg: 'background',
  },
});

// Export types
export type AppConfig = typeof tamaguiConfig;
declare module 'tamagui' {
  // Add a dummy property to avoid the empty interface warning
  interface TamaguiCustomConfig extends AppConfig {
    // This property is added to fix the TypeScript ESLint "no-empty-interface" warning
    // by ensuring the interface isn't empty
    __layerzWalletCustomConfig: true;
  }
}
