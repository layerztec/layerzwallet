/**
 * Hook to access the shared Layerz theme in the extension
 */

import { useColorScheme } from './useColorScheme';
import { LayerzTheme, LayerzDarkTheme, LayerzLightTheme, ThemeColorNames, ColorNames } from '@shared/theme';

type ColorSchemeType = 'light' | 'dark';

/**
 * Hook to access the theme in React components
 * This provides the same API across both extension and mobile platforms
 *
 * @returns The theme object with colors and utilities based on current color scheme
 */
export function useTheme() {
  const colorScheme = useColorScheme();
  const themeMode = colorScheme as ColorSchemeType;

  const theme = colorScheme === 'dark' ? LayerzDarkTheme : LayerzLightTheme;

  /**
   * Helper function to get a color from the theme
   * @param colorName - Name of the color to retrieve
   * @returns The color value
   */
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
    theme,
    colors: theme.colors,
    isDark: colorScheme === 'dark',
    colorScheme,
    getColor,
  };
}
