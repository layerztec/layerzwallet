import * as React from 'react';
import { Typography } from '../constants/Typography';
import { useThemeColor } from '../hooks/useThemeColor';

export interface WebTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  style?: any;
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link' | 'headline' | 'subHeadline' | 'paragraph';
}

// Helper function to convert React Native styles to CSS
const processStyle = (style: any) => {
  if (!style) return {};

  // Convert array of styles to a single object
  if (Array.isArray(style)) {
    return style.reduce((acc, curr) => ({ ...acc, ...(curr || {}) }), {});
  }

  return style;
};

export function ThemedText({ style, lightColor, darkColor, type = 'default', children, ...rest }: WebTextProps) {
  // Get color from theme hook
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  // Determine typography style
  let typographyStyle: any = {};
  if (type === 'defaultSemiBold') {
    typographyStyle = { ...Typography.paragraph, fontWeight: 700 };
  } else if (type === 'link') {
    typographyStyle = { ...Typography.paragraph, color: '#0a7ea4', lineHeight: '30px' };
  } else {
    const typographyKey = type === 'default' ? 'paragraph' : type === 'title' ? 'headline' : type === 'subtitle' ? 'subHeadline' : type;
    typographyStyle = Typography[typographyKey] || Typography.paragraph;
  }

  // Process all styles
  const combinedStyle = processStyle([{ color }, typographyStyle, style]);

  // Convert React Native style properties to CSS
  const webStyles = {
    ...combinedStyle,
    fontFamily: combinedStyle.fontFamily || 'inherit',
    fontSize: combinedStyle.fontSize ? `${combinedStyle.fontSize}px` : 'inherit',
    lineHeight: combinedStyle.lineHeight ? `${combinedStyle.lineHeight}px` : 'inherit',
    letterSpacing: combinedStyle.letterSpacing ? `${combinedStyle.letterSpacing}px` : 'inherit',
  };

  return (
    <span style={webStyles} {...rest}>
      {children}
    </span>
  );
}
