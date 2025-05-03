/**
 * Mobile implementation of the shared theme hook
 */
import { createTheme, ThemeMode } from '@shared/hooks/useThemeHook';
import { useColorScheme } from './useColorScheme';
import { StyleSheet } from 'react-native';

export interface ThemeOverrideProps {
  lightColor?: string;
  darkColor?: string;
}

// Define common font families
export const fontFamilies = {
  primary: undefined, // System default (San Francisco on iOS, Roboto on Android)
  secondary: undefined,
  mono: 'monospace',
};

// Define font weights
export const fontWeights = {
  regular: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
};

// Define text styles for consistent typography
export const textStyles = StyleSheet.create({
  // Display styles - for very large headers
  displayLarge: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: fontWeights.bold,
    letterSpacing: -0.5,
  },
  displayMedium: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: fontWeights.bold,
    letterSpacing: -0.5,
  },
  displaySmall: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: fontWeights.bold,
    letterSpacing: -0.25,
  },

  // Heading styles - for section headers
  headingLarge: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: fontWeights.bold,
  },
  headingMedium: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: fontWeights.bold,
  },
  headingSmall: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: fontWeights.semiBold,
  },

  // Subtitle styles - for section subheadings
  subtitleLarge: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: fontWeights.semiBold,
  },
  subtitleMedium: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: fontWeights.semiBold,
  },

  // Body styles - for paragraphs and main content
  bodyLarge: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: fontWeights.regular,
  },
  bodyMedium: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: fontWeights.regular,
  },
  bodySmall: {
    fontSize: 12,
    lineHeight: 20,
    fontWeight: fontWeights.regular,
  },

  // Label styles - for buttons and form components
  labelLarge: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: fontWeights.medium,
    letterSpacing: 0.1,
  },
  labelMedium: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: fontWeights.medium,
    letterSpacing: 0.1,
  },
  labelSmall: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: fontWeights.medium,
    letterSpacing: 0.1,
  },

  // Special styles
  button: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: fontWeights.semiBold,
    letterSpacing: 0.25,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: fontWeights.medium,
    textDecorationLine: 'underline',
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: fontWeights.regular,
    letterSpacing: 0.4,
  },
  overline: {
    fontSize: 10,
    lineHeight: 16,
    fontWeight: fontWeights.medium,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});

// Spacing system for consistent layout
export const spacing = {
  xxs: 2,
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

/**
 * Detect color scheme for mobile app
 */
function getMobileColorScheme(): ThemeMode {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark' ? 'dark' : 'light';
}

// Create theme hook using the platform-specific color scheme detector
export const useTheme = createTheme(getMobileColorScheme);
