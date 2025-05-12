// Super minimal Tamagui configuration
// This is intended as a fallback implementation if nothing else works
import { createTamagui } from 'tamagui';

// Absolute minimum configuration to make Tamagui work
const minimalConfig = createTamagui({
  defaultTheme: 'light',
  tokens: {
    color: {
      background: '#FFFFFF',
      backgroundDark: '#000000',
      text: '#000000',
      textDark: '#FFFFFF',
    },
    space: {
      0: 0,
      1: 4,
      2: 8,
      3: 16,
    },
    size: {
      0: 0,
      1: 4,
      2: 8,
      3: 16,
    },
    radius: {
      0: 0,
      1: 4,
      2: 8,
    },
  },
  themes: {
    light: {
      background: '#FFFFFF',
      color: '#000000',
    },
    dark: {
      background: '#000000',
      color: '#FFFFFF',
    },
  },
  fonts: {
    body: {
      family: 'System',
      size: {
        1: 12,
        2: 14,
        3: 16,
      },
      lineHeight: {
        1: 16,
        2: 20,
        3: 24,
      },
      weight: {
        regular: '400',
      },
    },
  },
  shorthands: {
    // Minimal set of shorthands
    p: 'padding',
    m: 'margin',
    bg: 'backgroundColor',
  },
});

export default minimalConfig;
export type AppConfig = typeof minimalConfig;
