import { View, type ViewProps } from 'react-native';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({ style, ...otherProps }: ThemedViewProps) {
  return <View style={[{ backgroundColor: 'transparent' }, style]} {...otherProps} />;
}
