import { TextProps } from 'react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { ThemedText as SharedThemedText, ThemedTextProps as SharedThemedTextProps } from '../../shared/components/ThemedText';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link' | 'headline' | 'subHeadline' | 'paragraph';
};

export function ThemedText({ style, lightColor, darkColor, type = 'default', ...rest }: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  // Convert React Native style prop to Tamagui compatible props
  const tamaguiProps: SharedThemedTextProps = {
    ...rest,
    type,
    lightColor,
    darkColor,
    color,
  };

  return <SharedThemedText {...tamaguiProps} />;
}
