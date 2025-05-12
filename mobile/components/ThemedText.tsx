import React from 'react';
import { Text, TextProps } from 'react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { ThemedTextProps as SharedThemedTextProps, typography } from '../../shared/components/ThemedText';

export type ThemedTextProps = TextProps & SharedThemedTextProps;

export function ThemedText({ style, lightColor, darkColor, type = 'default', children, ...rest }: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  // Map 'default' to 'paragraph' for typography
  const textType = type === 'default' ? 'paragraph' : type;

  // Get style properties based on text type
  const typographyStyle = typography[textType];

  // Check if the current text type is 'link' to use its special color
  const linkColor = textType === 'link' ? typography.link.color : undefined;

  return (
    <Text
      style={[
        {
          color: linkColor || color,
          fontSize: typographyStyle.fontSize,
          fontWeight: typographyStyle.fontWeight,
          lineHeight: typographyStyle.lineHeight,
          letterSpacing: typographyStyle.letterSpacing,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}
