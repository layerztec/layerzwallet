import { brandColors, grayScale, lightTheme, darkTheme } from '@shared/themes/colors';
import { fontSizes, fontWeights, lineHeights, textVariants } from '@shared/themes/typography';

// Use the shared theme colors directly from shared library
export const LayerzColors = {
  light: {
    // Base colors
    primary: brandColors.primary,
    primaryLight: brandColors.primaryLight,
    primaryDark: brandColors.primaryDark,
    secondary: brandColors.accent,
    secondaryLight: brandColors.accent,
    secondaryDark: brandColors.accent,
    accent: brandColors.accent,

    // Status colors
    success: brandColors.success,
    warning: brandColors.warning,
    error: brandColors.error,
    info: brandColors.info,

    // UI colors
    text: lightTheme.text,
    textSecondary: lightTheme.textSecondary,
    textTertiary: lightTheme.textTertiary,
    background: lightTheme.background,
    surfaceBackground: lightTheme.surfaceBackground,
    cardBackground: lightTheme.cardBackground,
    border: lightTheme.border,
    borderLight: lightTheme.borderLight,

    // Network colors
    selectedNetworkBackground: lightTheme.selectedNetworkBackground,
    selectedNetworkText: grayScale.white,
    networkButtonText: lightTheme.networkButtonText,

    // Actions
    send: brandColors.send,
    receive: brandColors.receive,

    // Essentials
    white: grayScale.white,
    black: grayScale.black,

    // Legacy compatibility
    icon: lightTheme.icon,
    tint: lightTheme.tint,
    tabIconDefault: lightTheme.tabIconDefault,
    tabIconSelected: lightTheme.tabIconSelected,
  },
  dark: {
    // Base colors
    primary: brandColors.primary, // Changed from primaryLight to match mobile
    primaryLight: brandColors.primaryLight,
    primaryDark: brandColors.primaryDark,
    secondary: brandColors.accent,
    secondaryLight: brandColors.accent,
    secondaryDark: brandColors.accent,
    accent: brandColors.accent,

    // Status colors
    success: brandColors.success,
    warning: brandColors.warning,
    error: brandColors.error,
    info: brandColors.info,

    // UI colors
    text: darkTheme.text,
    textSecondary: darkTheme.textSecondary,
    textTertiary: darkTheme.textTertiary,
    background: darkTheme.background,
    surfaceBackground: darkTheme.surfaceBackground,
    cardBackground: darkTheme.cardBackground,
    border: darkTheme.border,
    borderLight: darkTheme.borderLight,

    // Network colors
    selectedNetworkBackground: darkTheme.selectedNetworkBackground,
    selectedNetworkText: grayScale.white,
    networkButtonText: darkTheme.networkButtonText,

    // Actions
    send: brandColors.send,
    receive: brandColors.receive,

    // Essentials
    white: grayScale.white,
    black: grayScale.black,

    // Legacy compatibility
    icon: darkTheme.icon,
    tint: darkTheme.tint,
    tabIconDefault: darkTheme.tabIconDefault,
    tabIconSelected: darkTheme.tabIconSelected,
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
