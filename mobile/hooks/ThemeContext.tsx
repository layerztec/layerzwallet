/**
 * Theme context and provider for the mobile app
 */

import React, { createContext, useContext } from 'react';
import { useColorScheme } from '@/hooks/useColorScheme';

// Layerz Brand Colors
const LAYERZ_PRIMARY = '#3F51B5'; // Main brand color
const LAYERZ_SECONDARY = '#00ACC1'; // Secondary brand color
const LAYERZ_ACCENT = '#FF4081'; // Accent color for CTAs
const LAYERZ_SUCCESS = '#4CAF50'; // Success green
const LAYERZ_WARNING = '#FFC107'; // Warning yellow
const LAYERZ_ERROR = '#F44336'; // Error/danger red
const LAYERZ_NEUTRAL = '#9E9E9E'; // Neutral gray

// Color palette
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

    // Legacy colors (for backward compatibility)
    tint: '#3F51B5',
    icon: '#757575',
    tabIconDefault: '#9E9E9E',
    tabIconSelected: '#3F51B5',
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

    // Legacy colors (for backward compatibility)
    tint: '#7986CB',
    icon: '#BDBDBD',
    tabIconDefault: '#9E9E9E',
    tabIconSelected: '#7986CB',
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
