import React from 'react';
import { ThemedText as SharedThemedText, ThemedTextProps as SharedThemedTextProps } from '../../shared/components/ThemedText';

export type ThemedTextProps = Omit<SharedThemedTextProps, 'children'> & {
  children: React.ReactNode;
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link' | 'headline' | 'subHeadline' | 'paragraph';
};

export function ThemedText({ lightColor, darkColor, type = 'default', ...rest }: ThemedTextProps) {
  return <SharedThemedText type={type} lightColor={lightColor} darkColor={darkColor} {...rest} />;
}
