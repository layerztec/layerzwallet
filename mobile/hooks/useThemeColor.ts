/**
 * Custom hook to access theme colors and support light/dark mode
 */

import { useColorScheme } from './useColorScheme';
import { LayerzTheme, ColorNames, ThemeColorNames } from '../../shared/theme';

export function useThemeColor(props: { light?: string; dark?: string }, colorName: ThemeColorNames | ColorNames) {
  const theme = useColorScheme();
  const themeMode = theme as 'light' | 'dark';

  // Use provided colors first if available
  const colorFromProps = props[theme];
  if (colorFromProps) {
    return colorFromProps;
  }

  // Check if it's a theme-specific color
  if (colorName in LayerzTheme[themeMode]) {
    return LayerzTheme[themeMode][colorName as ThemeColorNames];
  }

  // Check if it's a base color
  if (colorName in LayerzTheme.colors) {
    return LayerzTheme.colors[colorName as ColorNames];
  }

  // Fallback
  return theme === 'dark' ? LayerzTheme.dark.text : LayerzTheme.light.text;
}

/**
 * Enhanced version of useThemeColor that offers similar API to extension's useTheme
 * to improve cross-platform consistency
 */
export function useExtendedThemeColor() {
  const colorScheme = useColorScheme();
  const themeMode = colorScheme as 'light' | 'dark';

  const getColor = (colorName: ThemeColorNames | ColorNames): string => {
    // Check if it's a theme-specific color
    if (colorName in LayerzTheme[themeMode]) {
      return LayerzTheme[themeMode][colorName as ThemeColorNames];
    }

    // Check if it's a base color
    if (colorName in LayerzTheme.colors) {
      return LayerzTheme.colors[colorName as ColorNames];
    }

    // Fallback to a safe default
    return themeMode === 'dark' ? LayerzTheme.dark.text : LayerzTheme.light.text;
  };

  return {
    colorScheme,
    isDark: colorScheme === 'dark',
    getColor,
  };
}
