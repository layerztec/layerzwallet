import React from 'react';
import { Text, TextProps } from 'react-native';

// Simplified version that doesn't depend on Tamagui
export type SimpleThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link' | 'headline' | 'subHeadline' | 'paragraph';
  lightColor?: string;
  darkColor?: string;
};

const typography = {
  headline: {
    fontSize: 32,
    fontWeight: '300' as const,
    lineHeight: 40,
    letterSpacing: 0.2,
  },
  subHeadline: {
    fontSize: 20,
    fontWeight: '400' as const,
    lineHeight: 28,
    letterSpacing: 0.1,
  },
  paragraph: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
    letterSpacing: 0.05,
  },
  defaultSemiBold: {
    fontSize: 16,
    fontWeight: '700' as const,
    lineHeight: 24,
    letterSpacing: 0.05,
  },
  link: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
    letterSpacing: 0.05,
    color: '#0a7ea4',
  },
  title: {
    fontSize: 32,
    fontWeight: '300' as const,
    lineHeight: 40,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '400' as const,
    lineHeight: 28,
    letterSpacing: 0.1,
  },
};

export function SimpleThemedText({ type = 'default', lightColor, darkColor, style, ...props }: SimpleThemedTextProps) {
  // Use a hardcoded color for now - in a real implementation, you'd use a theme context
  const isDark = false;
  const textColor = isDark ? darkColor || '#FFFFFF' : lightColor || '#011474';

  // Map 'default' to 'paragraph' for typography
  const textType = type === 'default' ? 'paragraph' : type;

  // Get style properties based on text type
  const typographyStyle = typography[textType as keyof typeof typography] || typography.paragraph;

  // Check if the current text type is 'link' to use its special color
  const linkColor = textType === 'link' ? typography.link.color : undefined;

  return (
    <Text
      style={[
        {
          color: linkColor || textColor,
          fontFamily: 'Inter-Regular',
          fontSize: typographyStyle.fontSize,
          fontWeight: typographyStyle.fontWeight,
          lineHeight: typographyStyle.lineHeight,
        },
        style,
      ]}
      {...props}
    />
  );
}
