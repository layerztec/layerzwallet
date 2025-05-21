import React, { CSSProperties } from 'react';
import { Typography } from '@shared/constants/Typography';
import { useThemeColor } from '@shared/hooks/useThemeColor.web';

export type ThemedTextProps = React.HTMLAttributes<HTMLSpanElement> & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link' | 'headline' | 'subHeadline' | 'paragraph';
};

export function ThemedText({ style, lightColor, darkColor, type = 'default', children, ...rest }: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  let typographyStyle: CSSProperties = {};

  if (type === 'defaultSemiBold') {
    typographyStyle = {
      ...Typography.paragraph,
      fontWeight: '700',
    };
  } else if (type === 'link') {
    typographyStyle = {
      ...Typography.paragraph,
      color: '#0a7ea4',
      lineHeight: '30px',
    };
  } else {
    const typographyKey = type === 'default' ? 'paragraph' : type === 'title' ? 'headline' : type === 'subtitle' ? 'subHeadline' : type;
    typographyStyle = {
      ...(Typography[typographyKey as keyof typeof Typography] || Typography.paragraph),
    };
  }

  const cssStyle: CSSProperties = {
    color,
    fontSize: typographyStyle.fontSize ? `${typographyStyle.fontSize}px` : undefined,
    fontWeight: typographyStyle.fontWeight as CSSProperties['fontWeight'],
    lineHeight: typographyStyle.lineHeight ? `${typographyStyle.lineHeight}px` : undefined,
    letterSpacing: typographyStyle.letterSpacing ? `${typographyStyle.letterSpacing}px` : undefined,
    ...(style as CSSProperties),
  };

  return (
    <span style={cssStyle} {...rest}>
      {children}
    </span>
  );
}
