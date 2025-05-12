import React from 'react';

// This is now a type-only export file
// Each platform will implement its own version of ThemedText
export type ThemedTextVariant = 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link' | 'headline' | 'subHeadline' | 'paragraph';

export type ThemedTextProps = {
  type?: ThemedTextVariant;
  lightColor?: string;
  darkColor?: string;
  color?: string;
  style?: any;
  children?: React.ReactNode;
  [key: string]: any; // Allow other props
};

// Typography definitions that can be shared across platforms
export const typography = {
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
