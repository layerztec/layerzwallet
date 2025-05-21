import React from 'react';
// Define our own TextProps instead of importing from react-native
import { Typography } from '../constants/Typography';
import { useThemeColor } from '../hooks/useThemeColor';

// Define TextProps for web compatibility
interface TextProps {
  style?: any;
  children?: React.ReactNode;
  [key: string]: any;
}

// Simple Text component for web
const Text: React.FC<TextProps> = ({ style, children, ...props }) => (
  <span style={style} {...props}>
    {children}
  </span>
);

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link' | 'headline' | 'subHeadline' | 'paragraph';
};

export function ThemedText({ style, lightColor, darkColor, type = 'default', ...rest }: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  let typographyStyle: any[] = [];
  if (type === 'defaultSemiBold') {
    typographyStyle = [Typography.paragraph, { fontWeight: '700' }];
  } else if (type === 'link') {
    typographyStyle = [Typography.paragraph, { color: '#0a7ea4', lineHeight: 30 }];
  } else {
    // Ensure typographyKey is a valid key of Typography
    let typographyKey: keyof typeof Typography;
    if (type === 'default') {
      typographyKey = 'paragraph';
    } else if (type === 'title') {
      typographyKey = 'headline';
    } else if (type === 'subtitle') {
      typographyKey = 'subHeadline';
    } else if (type === 'paragraph' || type === 'headline' || type === 'subHeadline') {
      typographyKey = type;
    } else {
      // Default fallback for any other case
      typographyKey = 'paragraph';
    }
    typographyStyle = [Typography[typographyKey]];
  }

  return <Text style={[{ color }, ...typographyStyle, style]} {...rest} />;
}
