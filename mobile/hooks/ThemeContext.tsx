/**
 * Theme context and provider for the mobile app
 */

import React, { createContext, useContext } from 'react';
import { useColorScheme } from '@/hooks/useColorScheme';
import { brandColors, grayScale, lightTheme, darkTheme } from '@shared/themes/colors';

// Color palette
export const LayerzColors = {
  light: {
    // Base colors
    primary: brandColors.primary,
    primaryLight: brandColors.primaryLight,
    primaryDark: brandColors.primaryDark,
    secondary: brandColors.accent,
    secondaryLight: grayScale.gray300,
    secondaryDark: grayScale.gray600,
    accent: brandColors.accent,
    accentLight: grayScale.gray200,
    accentDark: brandColors.accent,

    // Status colors
    success: brandColors.success,
    warning: brandColors.warning,
    error: brandColors.error,
    info: brandColors.info,

    // UI colors
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

    // Network colors
    selectedNetworkBackground: brandColors.primary,
    selectedNetworkText: grayScale.white,
    networkButtonText: lightTheme.text,

    // Action colors
    send: brandColors.send,
    receive: brandColors.receive,
    settingsIcon: lightTheme.icon,

    // Essentials
    white: grayScale.white,
    black: grayScale.black,

    // Legacy colors (for backward compatibility)
    tint: lightTheme.tint,
    icon: lightTheme.icon,
    tabIconDefault: lightTheme.tabIconDefault,
    tabIconSelected: lightTheme.tabIconSelected,
  },
  dark: {
    // Base colors
    primary: brandColors.primary,
    primaryLight: brandColors.primaryLight,
    primaryDark: brandColors.primaryDark,
    secondary: brandColors.accent,
    secondaryLight: grayScale.gray600,
    secondaryDark: grayScale.gray300,
    accent: brandColors.accent,
    accentLight: grayScale.gray600,
    accentDark: brandColors.accent,

    // Status colors
    success: brandColors.success,
    warning: brandColors.warning,
    error: brandColors.error,
    info: brandColors.info,

    // UI colors
    text: darkTheme.text,
    textSecondary: darkTheme.textSecondary,
    textTertiary: darkTheme.textTertiary,
    textInverted: grayScale.black,
    background: darkTheme.background,
    surfaceBackground: darkTheme.surfaceBackground,
    cardBackground: darkTheme.cardBackground,
    border: darkTheme.border,
    divider: darkTheme.borderLight,
    shadow: darkTheme.shadowColor,

    // Network colors
    selectedNetworkBackground: brandColors.primary,
    selectedNetworkText: grayScale.white,
    networkButtonText: darkTheme.text,

    // Action colors
    send: brandColors.send,
    receive: brandColors.receive,
    settingsIcon: darkTheme.icon,

    // Essentials
    white: grayScale.white,
    black: grayScale.black,

    // Legacy colors (for backward compatibility)
    tint: darkTheme.tint,
    icon: darkTheme.icon,
    tabIconDefault: darkTheme.tabIconDefault,
    tabIconSelected: darkTheme.tabIconSelected,
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
