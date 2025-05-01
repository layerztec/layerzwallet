/**
 * Custom hook to access theme colors and support light/dark mode
 */

import { useColorScheme } from '@/hooks/useColorScheme';
import { LayerzTheme, ThemeColorNames, ColorNames } from '@shared/theme';

type ColorSchemeType = 'light' | 'dark';

/**
 * Get a color from the theme based on the current color scheme
 *
 * @param props - Optional override colors for light and dark mode
 * @param colorName - Name of the color from the theme
 * @returns The appropriate color based on the current theme
 */
export function useThemeColor(props: { light?: string; dark?: string }, colorName: ThemeColorNames | ColorNames) {
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme as ColorSchemeType];

  if (colorFromProps) {
    return colorFromProps;
  }

  if (colorName in LayerzTheme[theme as ColorSchemeType]) {
    return LayerzTheme[theme as ColorSchemeType][colorName as ThemeColorNames];
  }

  if (colorName in LayerzTheme.colors) {
    return LayerzTheme.colors[colorName as ColorNames];
  }

  return theme === 'dark' ? LayerzTheme.dark.text : LayerzTheme.light.text;
}
