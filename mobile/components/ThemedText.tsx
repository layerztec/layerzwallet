import { Text, type TextProps, type TextStyle } from 'react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { Typography } from '@shared/constants/Typography';
import { BaseThemedTextProps } from '@shared/types/ThemedText';

export type ThemedTextProps = TextProps &
  BaseThemedTextProps & {
    textAlign?: TextStyle['textAlign'];
  };

export function ThemedText({ style, lightColor, darkColor, type = 'default', textAlign, ...rest }: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  let typographyStyle: any[] = [];
  if (type === 'defaultSemiBold') {
    typographyStyle = [Typography.paragraph, { fontWeight: '700' }];
  } else if (type === 'link') {
    typographyStyle = [Typography.paragraph, { color: '#0a7ea4', lineHeight: 30 }];
  } else {
    // Map the type to the correct typography key
    let typographyKey: keyof typeof Typography;
    if (type === 'default') {
      typographyKey = 'paragraph';
    } else if (type === 'title') {
      typographyKey = 'headline';
    } else if (type === 'subtitle') {
      typographyKey = 'subHeadline';
    } else if (type in Typography) {
      typographyKey = type as keyof typeof Typography;
    } else {
      typographyKey = 'paragraph'; // Fallback
    }
    typographyStyle = [Typography[typographyKey]];
  }
  const alignmentStyle = textAlign ? { textAlign } : {};

  return <Text style={[{ color }, ...typographyStyle, alignmentStyle, style]} {...rest} />;
}
