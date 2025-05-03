/**
 * Mobile implementation of the shared theme hook
 */
import { createTheme, ThemeMode } from '@shared/hooks/useThemeHook';
import { useColorScheme } from './useColorScheme';
import { StyleSheet } from 'react-native';
import { fontWeights as sharedFontWeights, fontSizes, textVariants as sharedTextVariants } from '@shared/themes/typography';

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

// Use shared font weights
export const fontWeights = sharedFontWeights;

// Convert the shared text variants to React Native StyleSheet
// This creates a matching typography system for the mobile app
export const textStyles = StyleSheet.create({
  displayLarge: {
    fontSize: sharedTextVariants.displayLarge.fontSize,
    lineHeight: sharedTextVariants.displayLarge.lineHeight,
    fontWeight: sharedTextVariants.displayLarge.fontWeight,
    letterSpacing: sharedTextVariants.displayLarge.letterSpacing,
  },
  displayMedium: {
    fontSize: sharedTextVariants.displayMedium.fontSize,
    lineHeight: sharedTextVariants.displayMedium.lineHeight,
    fontWeight: sharedTextVariants.displayMedium.fontWeight,
    letterSpacing: sharedTextVariants.displayMedium.letterSpacing,
  },
  displaySmall: {
    fontSize: sharedTextVariants.displaySmall.fontSize,
    lineHeight: sharedTextVariants.displaySmall.lineHeight,
    fontWeight: sharedTextVariants.displaySmall.fontWeight,
    letterSpacing: sharedTextVariants.displaySmall.letterSpacing,
  },

  // Heading styles
  headingLarge: {
    fontSize: sharedTextVariants.headingLarge.fontSize,
    lineHeight: sharedTextVariants.headingLarge.lineHeight,
    fontWeight: sharedTextVariants.headingLarge.fontWeight,
  },
  headingMedium: {
    fontSize: sharedTextVariants.headingMedium.fontSize,
    lineHeight: sharedTextVariants.headingMedium.lineHeight,
    fontWeight: sharedTextVariants.headingMedium.fontWeight,
  },
  headingSmall: {
    fontSize: sharedTextVariants.headingSmall.fontSize,
    lineHeight: sharedTextVariants.headingSmall.lineHeight,
    fontWeight: sharedTextVariants.headingSmall.fontWeight,
  },

  // Subtitle styles
  subtitleLarge: {
    fontSize: sharedTextVariants.subtitleLarge.fontSize,
    lineHeight: sharedTextVariants.subtitleLarge.lineHeight,
    fontWeight: sharedTextVariants.subtitleLarge.fontWeight,
  },
  subtitleMedium: {
    fontSize: sharedTextVariants.subtitleMedium.fontSize,
    lineHeight: sharedTextVariants.subtitleMedium.lineHeight,
    fontWeight: sharedTextVariants.subtitleMedium.fontWeight,
  },

  // Body styles
  bodyLarge: {
    fontSize: sharedTextVariants.bodyLarge.fontSize,
    lineHeight: sharedTextVariants.bodyLarge.lineHeight,
    fontWeight: sharedTextVariants.bodyLarge.fontWeight,
  },
  bodyMedium: {
    fontSize: sharedTextVariants.bodyMedium.fontSize,
    lineHeight: sharedTextVariants.bodyMedium.lineHeight,
    fontWeight: sharedTextVariants.bodyMedium.fontWeight,
  },
  bodySmall: {
    fontSize: sharedTextVariants.bodySmall.fontSize,
    lineHeight: sharedTextVariants.bodySmall.lineHeight,
    fontWeight: sharedTextVariants.bodySmall.fontWeight,
  },

  // Label styles
  labelLarge: {
    fontSize: sharedTextVariants.labelLarge.fontSize,
    lineHeight: sharedTextVariants.labelLarge.lineHeight,
    fontWeight: sharedTextVariants.labelLarge.fontWeight,
    letterSpacing: sharedTextVariants.labelLarge.letterSpacing,
  },
  labelMedium: {
    fontSize: sharedTextVariants.labelMedium.fontSize,
    lineHeight: sharedTextVariants.labelMedium.lineHeight,
    fontWeight: sharedTextVariants.labelMedium.fontWeight,
    letterSpacing: sharedTextVariants.labelMedium.letterSpacing,
  },
  labelSmall: {
    fontSize: sharedTextVariants.labelSmall.fontSize,
    lineHeight: sharedTextVariants.labelSmall.lineHeight,
    fontWeight: sharedTextVariants.labelSmall.fontWeight,
    letterSpacing: sharedTextVariants.labelSmall.letterSpacing,
  },

  // Special styles
  button: {
    fontSize: sharedTextVariants.button.fontSize,
    lineHeight: sharedTextVariants.button.lineHeight,
    fontWeight: sharedTextVariants.button.fontWeight,
    letterSpacing: sharedTextVariants.button.letterSpacing,
  },
  link: {
    fontSize: sharedTextVariants.link.fontSize,
    lineHeight: sharedTextVariants.link.lineHeight,
    fontWeight: sharedTextVariants.link.fontWeight,
    textDecorationLine: 'underline',
  },
  caption: {
    fontSize: sharedTextVariants.caption.fontSize,
    lineHeight: sharedTextVariants.caption.lineHeight,
    fontWeight: sharedTextVariants.caption.fontWeight,
    letterSpacing: sharedTextVariants.caption.letterSpacing,
  },
  overline: {
    fontSize: sharedTextVariants.overline.fontSize,
    lineHeight: sharedTextVariants.overline.lineHeight,
    fontWeight: sharedTextVariants.overline.fontWeight,
    letterSpacing: sharedTextVariants.overline.letterSpacing,
    textTransform: 'uppercase',
  },

  // Legacy variants for backward compatibility
  default: {
    fontSize: sharedTextVariants.bodyLarge.fontSize,
    lineHeight: sharedTextVariants.bodyLarge.lineHeight,
    fontWeight: sharedTextVariants.bodyLarge.fontWeight,
  },
  title: {
    fontSize: sharedTextVariants.headingLarge.fontSize,
    lineHeight: sharedTextVariants.headingLarge.lineHeight,
    fontWeight: sharedTextVariants.headingLarge.fontWeight,
  },
  subtitle: {
    fontSize: sharedTextVariants.subtitleLarge.fontSize,
    lineHeight: sharedTextVariants.subtitleLarge.lineHeight,
    fontWeight: sharedTextVariants.subtitleLarge.fontWeight,
  },
  defaultSemiBold: {
    fontSize: sharedTextVariants.bodyLarge.fontSize,
    lineHeight: sharedTextVariants.bodyLarge.lineHeight,
    fontWeight: sharedTextVariants.semiBold,
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
function useMobileColorScheme(): ThemeMode {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark' ? 'dark' : 'light';
}

// Create theme hook using the platform-specific color scheme detector
export const useTheme = createTheme(useMobileColorScheme);
