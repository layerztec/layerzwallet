/**
 * Theme context and provider for the mobile app
 */

import React, { createContext, useContext } from 'react';
import { useColorScheme } from './useColorScheme';
import { brandColors, grayScale, lightTheme } from '../../shared/themes/colors';

// Color palette
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

// Theme context
type ThemeContextType = {
  theme: 'light' | 'dark';
  getColor: (colorKey: string | { lightColor: string; darkColor: string }) => string;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  getColor: () => '#000000',
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme() ?? 'light';

  const getColor = (colorKey: string | { lightColor: string; darkColor: string }) => {
    if (typeof colorKey === 'object') {
      return colorScheme === 'light' ? colorKey.lightColor : colorKey.darkColor;
    }

    // @ts-ignore - The type of colorKey is dynamic
    return LayerzColors[colorScheme][colorKey] || LayerzColors[colorScheme].text;
  };

  return <ThemeContext.Provider value={{ theme: colorScheme, getColor }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
