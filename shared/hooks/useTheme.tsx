import { useColorScheme } from 'react-native';
import { COLORS, DefaultTheme, DarkTheme } from '../theme';

/**
 * Custom hook for accessing the theme in both the extension and mobile app
 * This hook follows the react-navigation theme structure but can be used independently
 */
export function useTheme() {
  // Get the device color scheme (light or dark)
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Get the appropriate theme based on the color scheme
  const theme = isDark ? DarkTheme : DefaultTheme;

  // Helper function to get colors based on the current theme
  const getColor = (colorName: keyof typeof COLORS) => {
    // Handle complex color objects (with light/dark variants)
    if (typeof COLORS[colorName] === 'object' && COLORS[colorName] !== null) {
      return isDark ? (COLORS[colorName] as any).dark : (COLORS[colorName] as any).light;
    }
    // Return direct color values
    return COLORS[colorName];
  };

  return {
    isDark,
    theme,
    colors: theme.colors,
    COLORS,
    getColor,
  };
}
