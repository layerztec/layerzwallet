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
    lineHeight: 47, // 36 * 1.3
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacing.tight,
  },
  displayMedium: {
    fontSize: fontSizes.xxxl, // 32px
    lineHeight: 42, // 32 * 1.31
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacing.tight,
  },
  displaySmall: {
    fontSize: fontSizes.xxl + 4, // 28px
    lineHeight: 37, // 28 * 1.32
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacing.tight,
  },

  // Heading styles - for section headers
  headingLarge: {
    fontSize: fontSizes.xxl, // 24px
    lineHeight: 32, // 24 * 1.33
    fontWeight: fontWeights.bold,
  },
  headingMedium: {
    fontSize: fontSizes.xl, // 20px
    lineHeight: 26, // 20 * 1.3
    fontWeight: fontWeights.bold,
  },
  headingSmall: {
    fontSize: fontSizes.lg, // 18px
    lineHeight: 24, // 18 * 1.33
    fontWeight: fontWeights.semiBold,
  },

  // Subtitle styles - for section subheadings
  subtitleLarge: {
    fontSize: fontSizes.md, // 16px
    lineHeight: 21, // 16 * 1.31
    fontWeight: fontWeights.semiBold,
  },
  subtitleMedium: {
    fontSize: fontSizes.sm, // 14px
    lineHeight: 18, // 14 * 1.28
    fontWeight: fontWeights.semiBold,
  },

  // Body styles - for paragraphs and main content
  bodyLarge: {
    fontSize: fontSizes.md, // 16px
    lineHeight: 21, // 16 * 1.31
    fontWeight: fontWeights.regular,
  },
  bodyMedium: {
    fontSize: fontSizes.sm, // 14px
    lineHeight: 18, // 14 * 1.28
    fontWeight: fontWeights.regular,
  },
  bodySmall: {
    fontSize: fontSizes.xs, // 12px
    lineHeight: 16, // 12 * 1.33
    fontWeight: fontWeights.regular,
  },

  // Label styles - for buttons and form components
  labelLarge: {
    fontSize: fontSizes.md, // 16px
    lineHeight: 21, // 16 * 1.31
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacing.normal,
  },
  labelMedium: {
    fontSize: fontSizes.sm, // 14px
    lineHeight: 18, // 14 * 1.28
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacing.normal,
  },
  labelSmall: {
    fontSize: fontSizes.xs, // 12px
    lineHeight: 16, // 12 * 1.33
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacing.normal,
  },

  // Special styles
  button: {
    fontSize: fontSizes.md, // 16px
    lineHeight: 21, // 16 * 1.31
    fontWeight: fontWeights.semiBold,
    letterSpacing: letterSpacing.normal,
  },
  link: {
    fontSize: fontSizes.md, // 16px
    lineHeight: 21, // 16 * 1.31
    fontWeight: fontWeights.medium,
  },
  caption: {
    fontSize: fontSizes.xs, // 12px
    lineHeight: 16, // 12 * 1.33
    fontWeight: fontWeights.regular,
    letterSpacing: letterSpacing.normal,
  },
  overline: {
    fontSize: 10,
    lineHeight: 14, // 10 * 1.4
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacing.wider,
  },
};
