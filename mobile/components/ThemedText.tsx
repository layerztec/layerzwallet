import { Text, type TextProps } from 'react-native';

import { useThemeColor } from '@/hooks/useThemeColor';
import { Typography } from '@shared/themes/typography';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'Paragraph' | 'Headline' | 'Subheadline' | 'Medium' | 'Bold' | 'Black' | 'Caption' | 'Button' | 'Link';
};

export function ThemedText({ style, lightColor, darkColor, type = 'Paragraph', ...rest }: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  // Map type to Typography style, fallback to Paragraph
  const getTypographyStyle = () => {
    if (type === 'Link') {
      return [{ color: '#0a7ea4', textDecorationLine: 'underline' }, Typography.Paragraph];
    }
    return Typography[type] || Typography.Paragraph;
  };

  return <Text style={[{ color }, getTypographyStyle(), style]} {...rest} />;
}
