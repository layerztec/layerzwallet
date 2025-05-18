import { createAnimations } from '@tamagui/animations-react-native';
import { createInterFont } from '@tamagui/font-inter';
import { createMedia } from '@tamagui/react-native-media-driver';
import { shorthands } from '@tamagui/shorthands';
import { createTamagui } from 'tamagui';

// Create animations
const animations = createAnimations({
  bouncy: {
    type: 'spring',
    damping: 10,
    mass: 0.9,
    stiffness: 100,
  },
  lazy: {
    type: 'spring',
    damping: 20,
    stiffness: 60,
  },
  quick: {
    type: 'spring',
    damping: 20,
    mass: 1.2,
    stiffness: 250,
  },
});

// Create fonts
const headingFont = createInterFont();
const bodyFont = createInterFont();

// Create tokens
const tokens = {
  size: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 36,
    10: 40,
    12: 48,
    14: 56,
    16: 64,
    20: 80,
    24: 96,
    32: 128,
    40: 160,
    // Add named font sizes with both regular and $ prefix versions
    small: 14,
    $small: 14,
    medium: 16,
    $medium: 16,
    large: 18,
    $large: 18,
    // Add the required "true" key for default size
    true: 16, // Using 16 (equivalent to $4) as the default size
    $true: 16,
  },
  space: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 36,
    10: 40,
    12: 48,
    14: 56,
    16: 64,
    20: 80,
    24: 96,
    32: 128,
    40: 160,
    // Add the required "true" key for default space
    true: 16, // Using 16 (equivalent to $4) as the default space
    $true: 16,
  },
  radius: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
  },
  zIndex: {
    0: 0,
    1: 100,
    2: 200,
    3: 300,
    4: 400,
    5: 500,
  },
  color: {
    white: '#ffffff',
    black: '#000000',

    gray1: '#f8f9fa',
    gray2: '#e9ecef',
    gray3: '#dee2e6',
    gray4: '#ced4da',
    gray5: '#adb5bd',
    gray6: '#6c757d',
    gray7: '#495057',
    gray8: '#343a40',
    gray9: '#212529',

    blue1: '#e6f7ff',
    blue2: '#bae7ff',
    blue3: '#91d5ff',
    blue4: '#69c0ff',
    blue5: '#40a9ff',
    blue6: '#1890ff',
    blue7: '#096dd9',
    blue8: '#0050b3',
    blue9: '#003a8c',
    blue10: '#002766',

    red1: '#fff1f0',
    red2: '#ffccc7',
    red3: '#ffa39e',
    red4: '#ff7875',
    red5: '#ff4d4f',
    red6: '#f5222d',
    red7: '#cf1322',
    red8: '#a8071a',
    red9: '#820014',
    red10: '#5c0011',
  },
};

// Create themes
const light = {
  background: tokens.color.white,
  backgroundHover: tokens.color.gray1,
  backgroundPress: tokens.color.gray2,
  backgroundFocus: tokens.color.gray2,
  color: tokens.color.gray9,
  colorHover: tokens.color.gray8,
  colorPress: tokens.color.gray7,
  colorFocus: tokens.color.gray8,
  borderColor: tokens.color.gray4,
  borderColorHover: tokens.color.gray5,
  borderColorPress: tokens.color.gray6,
  borderColorFocus: tokens.color.gray5,
  placeholderColor: tokens.color.gray5,
};

const dark = {
  background: tokens.color.gray9,
  backgroundHover: tokens.color.gray8,
  backgroundPress: tokens.color.gray7,
  backgroundFocus: tokens.color.gray7,
  color: tokens.color.gray1,
  colorHover: tokens.color.gray2,
  colorPress: tokens.color.gray3,
  colorFocus: tokens.color.gray2,
  borderColor: tokens.color.gray6,
  borderColorHover: tokens.color.gray5,
  borderColorPress: tokens.color.gray4,
  borderColorFocus: tokens.color.gray5,
  placeholderColor: tokens.color.gray6,
};

const themes = {
  light,
  dark,
};

const config = createTamagui({
  animations,
  defaultTheme: 'light',
  shouldAddPrefersColorThemes: false,
  themeClassNameOnRoot: false,
  shorthands,
  fonts: {
    heading: headingFont,
    body: bodyFont,
  },
  themes,
  tokens,
  media: createMedia({
    xs: { maxWidth: 660 },
    sm: { maxWidth: 800 },
    md: { maxWidth: 1020 },
    lg: { maxWidth: 1280 },
    xl: { maxWidth: 1420 },
    xxl: { maxWidth: 1600 },
    gtXs: { minWidth: 660 + 1 },
    gtSm: { minWidth: 800 + 1 },
    gtMd: { minWidth: 1020 + 1 },
    gtLg: { minWidth: 1280 + 1 },
    short: { maxHeight: 820 },
    tall: { minHeight: 820 },
    hoverNone: { hover: 'none' },
    pointerCoarse: { pointer: 'coarse' },
  }),
});

export type AppConfig = typeof config;

declare module 'tamagui' {
  // overrides TamaguiCustomConfig so your custom types
  // work everywhere you import `tamagui`
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config;
