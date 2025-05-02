import { View, type ViewProps } from 'react-native';
import { useTheme } from '@/hooks/ThemeContext';
import { ThemeOverrideProps } from '@shared/hooks/useThemeHook';

export type ThemedViewProps = ViewProps & ThemeOverrideProps;

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
  const { getColor } = useTheme();
  const backgroundColor = getColor(lightColor && darkColor ? { lightColor, darkColor } : 'background');

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
