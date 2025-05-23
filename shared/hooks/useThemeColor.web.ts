import { Colors } from '../constants/Colors';

/**
 * Hook to get theme-specific colors for web
 * Always returns light theme
 */
export function useThemeColor(props: { light?: string; dark?: string }, colorName: keyof typeof Colors.light & keyof typeof Colors.dark) {
  const theme = 'light';

  const colorFromProps = props[theme];
  if (colorFromProps) {
    return colorFromProps;
  }

  return Colors[theme][colorName];
}
