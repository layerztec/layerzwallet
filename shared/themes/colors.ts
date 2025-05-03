/**
 * Shared color palette for Layerz Wallet
 * These colors are used across both mobile and extension platforms
 */

/**
 * Core brand colors
 */
export const brandColors = {
  // Primary brand colors
  primary: '#0a7ea4',
  primaryLight: '#34a2c6',
  primaryDark: '#055e7d',

  // Action colors
  send: '#FF3B30', // Red for send actions
  receive: '#34C759', // Green for receive actions
  accent: '#f6921e', // Orange accent

  // Status colors
  success: '#4CAF50',
  warning: '#f39c12',
  error: '#e74c3c',
  info: '#3498db',
};

/**
 * Gray scale
 */
export const grayScale = {
  white: '#FFFFFF',
  gray100: '#F8F9FA',
  gray200: '#E9ECEF',
  gray300: '#DEE2E6',
  gray400: '#CED4DA',
  gray500: '#ADB5BD',
  gray600: '#6C757D',
  gray700: '#495057',
  gray800: '#343A40',
  gray900: '#212529',
  black: '#000000',
};

/**
 * Light theme colors
 */
export const lightTheme = {
  // Backgrounds
  background: grayScale.white,
  cardBackground: grayScale.white,
  surfaceBackground: grayScale.gray100,

  // Text
  text: grayScale.gray900,
  textSecondary: grayScale.gray700,
  textTertiary: grayScale.gray600,
  textDisabled: grayScale.gray500,

  // Borders
  border: grayScale.gray300,
  borderLight: grayScale.gray200,

  // Others
  icon: grayScale.gray700,
  shadowColor: grayScale.gray400,
  tint: brandColors.primary,
  tabIconDefault: grayScale.gray600,
  tabIconSelected: brandColors.primary,

  // Navigation
  notification: brandColors.accent,
};

/**
 * Dark theme colors
 */
export const darkTheme = {
  // Backgrounds
  background: '#151718',
  cardBackground: '#1e2021',
  surfaceBackground: '#262a2b',

  // Text
  text: '#ECEDEE',
  textSecondary: '#c7c9cb',
  textTertiary: '#9BA1A6',
  textDisabled: '#6c7175',

  // Borders
  border: '#2e3133',
  borderLight: '#383d3f',

  // Others
  icon: '#9BA1A6',
  shadowColor: '#090a0a',
  tint: brandColors.primaryLight,
  tabIconDefault: '#9BA1A6',
  tabIconSelected: grayScale.white,

  // Navigation
  notification: brandColors.accent,
};

/**
 * Component specific colors - consistent across light and dark modes
 */
export const componentColors = {
  // Button colors
  sendButton: brandColors.send,
  receiveButton: brandColors.receive,
  primaryButton: brandColors.primary,
  secondaryButton: brandColors.accent,

  // Network buttons
  selectedNetworkBackground: brandColors.primary,
  networkButtonText: grayScale.gray800,
  selectedNetworkText: grayScale.white,

  // Icons
  qrScanIcon: brandColors.primary,
  settingsIcon: brandColors.primary,
};

export type ThemeMode = 'light' | 'dark';
