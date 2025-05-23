import * as React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { Typography } from '../constants/Typography';
import { useThemeColor } from '../hooks/useThemeColor';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  id?: string; // Added id prop for consistency with web implementation. Will updaate later.
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link' | 'headline' | 'subHeadline' | 'paragraph';
};

export function ThemedText({ style, lightColor, darkColor, type = 'default', ...rest }: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  let baseStyle = Typography.paragraph;
  let typeColor = color;

  if (type === 'defaultSemiBold') {
    baseStyle = Typography.paragraph;
  } else if (type === 'link') {
    baseStyle = Typography.paragraph;
    typeColor = '#0a7ea4';
  } else if (type === 'title' || type === 'headline') {
    baseStyle = Typography.headline;
  } else if (type === 'subtitle' || type === 'subHeadline') {
    baseStyle = Typography.subHeadline;
  }

  const textStyle: TextStyle = {
    color: typeColor,
    fontSize: baseStyle.fontSize,
    fontWeight: type === 'defaultSemiBold' ? '700' : (baseStyle.fontWeight as TextStyle['fontWeight']),
    lineHeight: baseStyle.lineHeight,
    letterSpacing: baseStyle.letterSpacing,
    fontFamily: baseStyle.fontFamily || undefined,
    ...(style as TextStyle),
  };

  return <Text style={textStyle} {...rest} />;
}
