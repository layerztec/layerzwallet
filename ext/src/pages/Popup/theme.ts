import { brandColors, grayScale, lightTheme, darkTheme } from '@shared/themes/colors';
import { fontSizes, fontWeights, lineHeights, textVariants } from '@shared/themes/typography';

// Use the shared theme colors directly from shared library
export const LayerzColors = {
  light: {
    primary: brandColors.primary,
    primaryLight: brandColors.primaryLight,
    primaryDark: brandColors.primaryDark,
    secondary: brandColors.accent,
    secondaryLight: grayScale.gray300,
    secondaryDark: grayScale.gray600,
    accent: brandColors.accent,
    accentLight: grayScale.gray200,
    accentDark: brandColors.accent,
    success: brandColors.success,
    warning: brandColors.warning,
    error: brandColors.error,
    info: brandColors.info,
    text: lightTheme.text,
    textSecondary: lightTheme.textSecondary,
    textTertiary: lightTheme.textTertiary,
    textInverted: grayScale.white,
    background: lightTheme.background,
    surfaceBackground: lightTheme.surfaceBackground,
    cardBackground: lightTheme.cardBackground,
    border: lightTheme.border,
    divider: lightTheme.borderLight,
    shadow: lightTheme.shadowColor,
    selectedNetworkBackground: brandColors.primary,
    selectedNetworkText: grayScale.white,
    networkButtonText: lightTheme.text,
    send: brandColors.send,
    receive: brandColors.receive,
    settingsIcon: lightTheme.icon,
    white: grayScale.white,
    black: grayScale.black,
    tint: lightTheme.tint,
    icon: lightTheme.icon,
    tabIconDefault: lightTheme.tabIconDefault,
    tabIconSelected: lightTheme.tabIconSelected,
    sendButton: brandColors.send,
    receiveButton: brandColors.receive,
  },
  dark: {
    // Use the exact same values as light
    primary: brandColors.primary,
    primaryLight: brandColors.primaryLight,
    primaryDark: brandColors.primaryDark,
    secondary: brandColors.accent,
    secondaryLight: grayScale.gray300,
    secondaryDark: grayScale.gray600,
    accent: brandColors.accent,
    accentLight: grayScale.gray200,
    accentDark: brandColors.accent,
    success: brandColors.success,
    warning: brandColors.warning,
    error: brandColors.error,
    info: brandColors.info,
    text: lightTheme.text,
    textSecondary: lightTheme.textSecondary,
    textTertiary: lightTheme.textTertiary,
    textInverted: grayScale.white,
    background: lightTheme.background,
    surfaceBackground: lightTheme.surfaceBackground,
    cardBackground: lightTheme.cardBackground,
    border: lightTheme.border,
    divider: lightTheme.borderLight,
    shadow: lightTheme.shadowColor,
    selectedNetworkBackground: brandColors.primary,
    selectedNetworkText: grayScale.white,
    networkButtonText: lightTheme.text,
    send: brandColors.send,
    receive: brandColors.receive,
    settingsIcon: lightTheme.icon,
    white: grayScale.white,
    black: grayScale.black,
    tint: lightTheme.tint,
    icon: lightTheme.icon,
    tabIconDefault: lightTheme.tabIconDefault,
    tabIconSelected: lightTheme.tabIconSelected,
    sendButton: brandColors.send,
    receiveButton: brandColors.receive,
  },
};

// Hook to get theme colors from current color scheme
export function useLayerzTheme() {
  // Use browser's matchMedia instead of react-native-web
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return LayerzColors[isDarkMode ? 'dark' : 'light'];
}

// Function to get current theme and listen for system changes
export function getThemeWithListener(callback: (theme: 'light' | 'dark') => void) {
  // Check initial theme
  const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const initialTheme = darkModeQuery.matches ? 'dark' : 'light';

  // Set up listener for theme changes
  darkModeQuery.addEventListener('change', (e) => {
    callback(e.matches ? 'dark' : 'light');
  });

  return initialTheme;
}

// Added function to get current theme without setting up a listener
export function getCurrentTheme(): 'light' | 'dark' {
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return isDarkMode ? 'dark' : 'light';
}

// Spacing units for consistent layout
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Border radius tokens
export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  round: 9999,
};

// Typography - Import directly from shared system
export const typography = {
  fontSizes,
  fontWeights,
  lineHeights,
  textVariants,
};
