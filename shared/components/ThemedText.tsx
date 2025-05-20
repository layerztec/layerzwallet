import { Text, type TextProps } from 'react-native';
import { Typography } from '../constants/Typography';
import { useThemeColor } from '../hooks/useThemeColor';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link' | 'headline' | 'subHeadline' | 'paragraph';
};

export function ThemedText({ style, lightColor, darkColor, type = 'default', ...rest }: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  let typographyStyle: any[] = [];
  if (type === 'defaultSemiBold') {
    typographyStyle = [Typography.paragraph, { fontWeight: '700' }];
  } else if (type === 'link') {
    typographyStyle = [Typography.paragraph, { color: '#0a7ea4', lineHeight: 30 }];
  } else {
    const typographyKey = type === 'default' ? 'paragraph' : type === 'title' ? 'headline' : type === 'subtitle' ? 'subHeadline' : type;
    typographyStyle = [Typography[typographyKey] || Typography.paragraph];
  }

  return <Text style={[{ color }, ...typographyStyle, style]} {...rest} />;
}
