/**
 * Shared typography system for Layerz Wallet
 * This file defines typography standards used across both mobile and extension platforms
 */

/**
 * Font weights
 */
export const fontWeights = {
  regular: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
};

/**
 * Font sizes (in pixels)
 */
export const fontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

/**
 * Line heights (in pixels)
 */
export const lineHeights = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 28,
  xl: 32,
  xxl: 36,
  xxxl: 44,
};

/**
 * Letter spacing (em units)
 */
export const letterSpacing = {
  tight: '-0.5px',
  normal: '0px',
  wide: '0.5px',
  wider: '1.5px',
};

/**
 * Font families
 * Note: These will need to be implemented specifically for each platform
 */
export const fontFamilies = {
  primary: 'System',
  mono: 'monospace',
};

/**
 * Style mapping to create consistent text variants across platforms
 */
export const textVariants = {
  // Display styles - for very large headers
  displayLarge: {
    fontSize: fontSizes.xxxl + 4, // 36px
    lineHeight: lineHeights.xxxl,
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacing.tight,
  },
  displayMedium: {
    fontSize: fontSizes.xxxl, // 32px
    lineHeight: lineHeights.xxxl - 4, // 40px
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacing.tight,
  },
  displaySmall: {
    fontSize: fontSizes.xxl + 4, // 28px
    lineHeight: lineHeights.xxxl - 8, // 36px
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacing.tight,
  },

  // Heading styles - for section headers
  headingLarge: {
    fontSize: fontSizes.xxl,
    lineHeight: lineHeights.xxl,
    fontWeight: fontWeights.bold,
  },
  headingMedium: {
    fontSize: fontSizes.xl,
    lineHeight: lineHeights.xl,
    fontWeight: fontWeights.bold,
  },
  headingSmall: {
    fontSize: fontSizes.lg,
    lineHeight: lineHeights.lg,
    fontWeight: fontWeights.semiBold,
  },

  // Subtitle styles - for section subheadings
  subtitleLarge: {
    fontSize: fontSizes.md,
    lineHeight: lineHeights.md,
    fontWeight: fontWeights.semiBold,
  },
  subtitleMedium: {
    fontSize: fontSizes.sm,
    lineHeight: lineHeights.sm + 2, // 22px
    fontWeight: fontWeights.semiBold,
  },

  // Body styles - for paragraphs and main content
  bodyLarge: {
    fontSize: fontSizes.md,
    lineHeight: lineHeights.md,
    fontWeight: fontWeights.regular,
  },
  bodyMedium: {
    fontSize: fontSizes.sm,
    lineHeight: lineHeights.sm + 2, // 22px
    fontWeight: fontWeights.regular,
  },
  bodySmall: {
    fontSize: fontSizes.xs,
    lineHeight: lineHeights.sm,
    fontWeight: fontWeights.regular,
  },

  // Label styles - for buttons and form components
  labelLarge: {
    fontSize: fontSizes.md,
    lineHeight: lineHeights.sm,
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacing.normal,
  },
  labelMedium: {
    fontSize: fontSizes.sm,
    lineHeight: lineHeights.xs + 2, // 18px
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacing.normal,
  },
  labelSmall: {
    fontSize: fontSizes.xs,
    lineHeight: lineHeights.xs,
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacing.normal,
  },

  // Special styles
  button: {
    fontSize: fontSizes.md,
    lineHeight: lineHeights.sm,
    fontWeight: fontWeights.semiBold,
    letterSpacing: letterSpacing.normal,
  },
  link: {
    fontSize: fontSizes.md,
    lineHeight: lineHeights.md,
    fontWeight: fontWeights.medium,
  },
  caption: {
    fontSize: fontSizes.xs,
    lineHeight: lineHeights.xs,
    fontWeight: fontWeights.regular,
    letterSpacing: letterSpacing.normal,
  },
  overline: {
    fontSize: 10,
    lineHeight: lineHeights.xs,
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacing.wider,
  },
};
