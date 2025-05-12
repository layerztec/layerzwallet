import React from 'react';
import { ThemedTextProps as SharedThemedTextProps, typography } from '../shared-link/components/ThemedText';

export type ThemedTextProps = SharedThemedTextProps & {
  children: React.ReactNode;
};

export function ThemedText({ lightColor, darkColor, type = 'default', style, children, ...rest }: ThemedTextProps) {
  // Use browser's prefers-color-scheme media query for dark mode detection
  const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const textColor = prefersDarkMode ? darkColor || '#FFFFFF' : lightColor || '#011474';

  // Map 'default' to 'paragraph' for typography
  const textType = type === 'default' ? 'paragraph' : type;

  // Get style properties based on text type
  const typographyStyle = typography[textType];

  // Check if the current text type is 'link' to use its special color
  const linkColor = textType === 'link' ? typography.link.color : undefined;

  const combinedStyle = {
    color: linkColor || textColor,
    fontSize: `${typographyStyle.fontSize}px`,
    fontWeight: typographyStyle.fontWeight,
    lineHeight: `${typographyStyle.lineHeight}px`,
    letterSpacing: `${typographyStyle.letterSpacing}px`,
    fontFamily: 'Inter, sans-serif',
    ...style,
  };

  return (
    <span style={combinedStyle} {...rest}>
      {children}
    </span>
  );
}
