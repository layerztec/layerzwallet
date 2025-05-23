import { Colors } from '../constants/Colors';

export function useThemeColor(props: { light?: string; dark?: string }, colorName: keyof typeof Colors.light & keyof typeof Colors.dark) {
  const theme = 'light';

  const colorFromProps = props[theme];
  if (colorFromProps) {
    return colorFromProps;
  }

  return Colors[theme][colorName];
}
