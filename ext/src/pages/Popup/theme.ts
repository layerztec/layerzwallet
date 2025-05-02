// Layerz Brand Colors - identical to mobile for consistency
const LAYERZ_PRIMARY = '#3F51B5'; // Main brand color
const LAYERZ_SECONDARY = '#00ACC1'; // Secondary brand color
const LAYERZ_ACCENT = '#FF4081'; // Accent color for CTAs
const LAYERZ_SUCCESS = '#4CAF50'; // Success green
const LAYERZ_WARNING = '#FFC107'; // Warning yellow
const LAYERZ_ERROR = '#F44336'; // Error/danger red
const LAYERZ_NEUTRAL = '#9E9E9E'; // Neutral gray

// Color palette that mirrors mobile's theme
export const LayerzColors = {
  light: {
    // Base colors
    primary: LAYERZ_PRIMARY,
    primaryLight: '#7986CB',
    primaryDark: '#303F9F',
    secondary: LAYERZ_SECONDARY,
    secondaryLight: '#4DD0E1',
    secondaryDark: '#0097A7',
    accent: LAYERZ_ACCENT,
    accentLight: '#FF80AB',
    accentDark: '#F50057',

    // Status colors
    success: LAYERZ_SUCCESS,
    warning: LAYERZ_WARNING,
    error: LAYERZ_ERROR,
    info: '#2196F3',

    // UI colors
    text: '#212121',
    textSecondary: '#757575',
    textTertiary: '#9E9E9E',
    textInverted: '#FFFFFF',
    background: '#FFFFFF',
    surfaceBackground: '#F5F5F5',
    cardBackground: '#FFFFFF',
    border: '#E0E0E0',
    divider: '#EEEEEE',
    shadow: 'rgba(0, 0, 0, 0.1)',

    // Network colors
    selectedNetworkBackground: '#3F51B5',
    selectedNetworkText: '#FFFFFF',
    networkButtonText: '#212121',

    // Action colors
    send: '#F44336',
    receive: '#4CAF50',
    settingsIcon: '#757575',

    // Essentials
    white: '#FFFFFF',
    black: '#000000',
  },
  dark: {
    // Base colors
    primary: '#7986CB',
    primaryLight: '#9FA8DA',
    primaryDark: '#3F51B5',
    secondary: '#4DD0E1',
    secondaryLight: '#80DEEA',
    secondaryDark: '#00ACC1',
    accent: '#FF80AB',
    accentLight: '#FF99B9',
    accentDark: '#FF4081',

    // Status colors
    success: '#66BB6A',
    warning: '#FFD54F',
    error: '#EF5350',
    info: '#42A5F5',

    // UI colors
    text: '#EEEEEE',
    textSecondary: '#BDBDBD',
    textTertiary: '#9E9E9E',
    textInverted: '#212121',
    background: '#121212',
    surfaceBackground: '#1E1E1E',
    cardBackground: '#2D2D2D',
    border: '#424242',
    divider: '#323232',
    shadow: 'rgba(0, 0, 0, 0.2)',

    // Network colors
    selectedNetworkBackground: '#7986CB',
    selectedNetworkText: '#FFFFFF',
    networkButtonText: '#EEEEEE',

    // Action colors
    send: '#EF5350',
    receive: '#66BB6A',
    settingsIcon: '#BDBDBD',

    // Essentials
    white: '#FFFFFF',
    black: '#000000',
  },
};

// Typography system for consistent text styling
export const fontFamilies = {
  primary: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
  mono: '"JetBrains Mono", "Roboto Mono", Menlo, Monaco, Consolas, "Courier New", monospace',
};

export const fontWeights = {
  regular: 400,
  medium: 500,
  semiBold: 600,
  bold: 700,
};

// Text styles that mirror the mobile app
export const textStyles = {
  // Display styles - for very large headers
  displayLarge: {
    fontSize: '36px',
    lineHeight: '44px',
    fontWeight: fontWeights.bold,
    letterSpacing: '-0.5px',
  },
  displayMedium: {
    fontSize: '32px',
    lineHeight: '40px',
    fontWeight: fontWeights.bold,
    letterSpacing: '-0.5px',
  },
  displaySmall: {
    fontSize: '28px',
    lineHeight: '36px',
    fontWeight: fontWeights.bold,
    letterSpacing: '-0.25px',
  },

  // Heading styles - for section headers
  headingLarge: {
    fontSize: '24px',
    lineHeight: '32px',
    fontWeight: fontWeights.bold,
  },
  headingMedium: {
    fontSize: '20px',
    lineHeight: '28px',
    fontWeight: fontWeights.bold,
  },
  headingSmall: {
    fontSize: '18px',
    lineHeight: '26px',
    fontWeight: fontWeights.semiBold,
  },

  // Subtitle styles - for section subheadings
  subtitleLarge: {
    fontSize: '16px',
    lineHeight: '24px',
    fontWeight: fontWeights.semiBold,
  },
  subtitleMedium: {
    fontSize: '14px',
    lineHeight: '22px',
    fontWeight: fontWeights.semiBold,
  },

  // Body styles - for paragraphs and main content
  bodyLarge: {
    fontSize: '16px',
    lineHeight: '24px',
    fontWeight: fontWeights.regular,
  },
  bodyMedium: {
    fontSize: '14px',
    lineHeight: '22px',
    fontWeight: fontWeights.regular,
  },
  bodySmall: {
    fontSize: '12px',
    lineHeight: '20px',
    fontWeight: fontWeights.regular,
  },

  // Label styles - for buttons and form components
  labelLarge: {
    fontSize: '16px',
    lineHeight: '20px',
    fontWeight: fontWeights.medium,
    letterSpacing: '0.1px',
  },
  labelMedium: {
    fontSize: '14px',
    lineHeight: '18px',
    fontWeight: fontWeights.medium,
    letterSpacing: '0.1px',
  },
  labelSmall: {
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: fontWeights.medium,
    letterSpacing: '0.1px',
  },

  // Special styles
  button: {
    fontSize: '16px',
    lineHeight: '20px',
    fontWeight: fontWeights.semiBold,
    letterSpacing: '0.25px',
  },
  link: {
    fontSize: '16px',
    lineHeight: '24px',
    fontWeight: fontWeights.medium,
    textDecoration: 'underline',
  },
  caption: {
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: fontWeights.regular,
    letterSpacing: '0.4px',
  },
  overline: {
    fontSize: '10px',
    lineHeight: '16px',
    fontWeight: fontWeights.medium,
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
  },
};

// Spacing system for consistent layout
export const spacing = {
  xxs: '2px',
  xs: '4px',
  s: '8px',
  m: '16px',
  l: '24px',
  xl: '32px',
  xxl: '48px',
  xxxl: '64px',
};

// Border radius system
export const borderRadius = {
  xs: '2px',
  s: '4px',
  m: '8px',
  l: '12px',
  xl: '16px',
  xxl: '24px',
  round: '50%',
};

// Function to get current theme
export const getCurrentTheme = () => {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  // You can extend this to use stored preferences
  return prefersDark ? 'dark' : 'light';
};

// Helper function to get color value
export const getLayerzColor = (colorKey: string) => {
  const theme = getCurrentTheme();
  return LayerzColors[theme][colorKey] || LayerzColors[theme].text;
};
