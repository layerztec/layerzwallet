import { Colors } from '../constants/Colors';
// Import from the local shared-link directory
import { useColorScheme } from './useColorScheme';

type ThemeType = 'light' | 'dark';
type ThemeProps = { light?: string; dark?: string };

export function useThemeColor(props: ThemeProps, colorName: keyof typeof Colors.light & keyof typeof Colors.dark) {
  const theme = (useColorScheme() ?? 'light') as ThemeType;
  const colorFromProps = theme === 'light' ? props.light : props.dark;

  if (colorFromProps) {
    return colorFromProps;
  } else {
    // Type-safe indexing
    return Colors[theme][colorName];
  }
}
