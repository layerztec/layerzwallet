import { createTamagui } from 'tamagui';
import { shorthands } from '@tamagui/shorthands';

// Ultra-minimal configuration for basic functionality
// Designed to avoid any initialization issues
const fontConfig = {
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
  family: {
    heading: 'Inter',
    body: 'Inter',
  },
};

// Define tokens
const tokens = {
  color: {
    primary: '#011474',
    secondary: '#FD5D2B',
    background: '#FFFFFF',
    text: '#011474',
    backgroundDark: '#011474',
    textDark: '#FFFFFF',
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
  size: {
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
  },
  zIndex: {
    0: 0,
    1: 100,
    2: 200,
    3: 300,
  },
};

// Define themes
const themes = {
  light: {
    background: tokens.color.background,
    color: tokens.color.text,
    borderColor: '#CECDCD',
  },
  dark: {
    background: tokens.color.backgroundDark,
    color: tokens.color.textDark,
    borderColor: '#333333',
  },
};

// Create and export the Tamagui config - ultra-minimal version
// Note: We're using only system fonts to avoid any potential font loading issues
const tamaguiConfig = createTamagui({
  defaultTheme: 'light',
  fonts: {
    // Using system fonts only for maximum reliability
    heading: {
      family: 'System',
      size: fontConfig.size,
      lineHeight: fontConfig.lineHeight,
      weight: fontConfig.weight,
      letterSpacing: fontConfig.letterSpacing,
    },
    body: {
      family: 'System',
      size: fontConfig.size,
      lineHeight: fontConfig.lineHeight,
      weight: fontConfig.weight,
      letterSpacing: fontConfig.letterSpacing,
    },
  },
  tokens,
  themes,
  shorthands,
});

// Export the configuration
export default tamaguiConfig;

// Much simpler type declaration - just export the type
export type AppConfig = typeof tamaguiConfig;
