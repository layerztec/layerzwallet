import React from 'react';

// Simplified version that doesn't depend on Tamagui
export type SimpleThemedTextProps = React.HTMLAttributes<HTMLSpanElement> & {
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link' | 'headline' | 'subHeadline' | 'paragraph';
  lightColor?: string;
  darkColor?: string;
};

const typography = {
  headline: {
    fontSize: '32px',
    fontWeight: 300,
    lineHeight: '40px',
    letterSpacing: '0.2px',
  },
  subHeadline: {
    fontSize: '20px',
    fontWeight: 400,
    lineHeight: '28px',
    letterSpacing: '0.1px',
  },
  paragraph: {
    fontSize: '16px',
    fontWeight: 400,
    lineHeight: '24px',
    letterSpacing: '0.05px',
  },
  defaultSemiBold: {
    fontSize: '16px',
    fontWeight: 700,
    lineHeight: '24px',
    letterSpacing: '0.05px',
  },
  link: {
    fontSize: '16px',
    fontWeight: 400,
    lineHeight: '24px',
    letterSpacing: '0.05px',
    color: '#0a7ea4',
  },
  title: {
    fontSize: '32px',
    fontWeight: 300,
    lineHeight: '40px',
    letterSpacing: '0.2px',
  },
  subtitle: {
    fontSize: '20px',
    fontWeight: 400,
    lineHeight: '28px',
    letterSpacing: '0.1px',
  },
};

export function SimpleThemedText({ type = 'default', lightColor, darkColor, style, ...props }: SimpleThemedTextProps) {
  // For extension, we could check for dark mode with a media query or context
  const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const textColor = isDark ? darkColor || '#FFFFFF' : lightColor || '#011474';

  // Map 'default' to 'paragraph' for typography
  const textType = type === 'default' ? 'paragraph' : type;

  // Get style properties based on text type
  const typographyStyle = typography[textType as keyof typeof typography] || typography.paragraph;

  // Check if the current text type is 'link' to use its special color
  const linkColor = textType === 'link' ? typography.link.color : undefined;

  const inlineStyle = {
    color: linkColor || textColor,
    fontFamily: 'Inter, sans-serif',
    fontSize: typographyStyle.fontSize,
    fontWeight: typographyStyle.fontWeight,
    lineHeight: typographyStyle.lineHeight,
    letterSpacing: typographyStyle.letterSpacing,
    ...(style as React.CSSProperties),
  };

  return <span style={inlineStyle} {...props} />;
}
