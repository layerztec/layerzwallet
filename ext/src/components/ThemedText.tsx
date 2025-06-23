import * as React from 'react';
import { Typography } from '@shared/constants/Typography';
import { Colors } from '@shared/constants/Colors';
import { WebThemedTextProps, TypographyKey } from '@shared/types/ThemedText';

export type ThemedTextProps = Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'> & WebThemedTextProps;

const baseStyles: React.CSSProperties = {
  fontFamily: 'Inter-Regular, sans-serif',
};

const typeStyles: Record<string, React.CSSProperties> = {
  headline: {
    fontFamily: 'Inter-Light, sans-serif',
    fontSize: '32px',
    fontWeight: '300',
    lineHeight: '40px',
    letterSpacing: '0.2px',
  },
  subHeadline: {
    fontFamily: 'Inter-Regular, sans-serif',
    fontSize: '20px',
    fontWeight: '400',
    lineHeight: '28px',
    letterSpacing: '0.1px',
  },
  paragraph: {
    fontFamily: 'Inter-Regular, sans-serif',
    fontSize: '16px',
    fontWeight: '400',
    lineHeight: '24px',
    letterSpacing: '0.05px',
  },
  defaultSemiBold: {
    fontFamily: 'Inter-Regular, sans-serif',
    fontSize: '16px',
    fontWeight: '700',
    lineHeight: '24px',
    letterSpacing: '0.05px',
  },
  link: {
    fontFamily: 'Inter-Regular, sans-serif',
    fontSize: '16px',
    fontWeight: '400',
    lineHeight: '30px',
    letterSpacing: '0.05px',
    color: '#0a7ea4',
    cursor: 'pointer',
    textDecoration: 'none',
  },
};

export const ThemedText: React.FC<ThemedTextProps> = ({ style, lightColor, darkColor, type = 'default', size, color: colorProp, children, ...rest }) => {
  const color = colorProp || lightColor || Colors.light.text;

  let customStyles: React.CSSProperties = {
    ...baseStyles,
    color,
    ...style,
  };

  if (size !== undefined) {
    customStyles.fontSize = typeof size === 'number' ? `${size}px` : size;
  }

  // Special cases that don't directly map to Typography constants
  if (type === 'defaultSemiBold') {
    customStyles = {
      ...customStyles,
      ...typeStyles.defaultSemiBold,
    };
  } else if (type === 'link') {
    customStyles = {
      ...customStyles,
      ...typeStyles.link,
    };
  } else {
    // Map the type to the correct typography key
    let typographyKey: TypographyKey;

    if (type === 'default') typographyKey = 'paragraph';
    else if (type === 'title') typographyKey = 'headline';
    else if (type === 'subtitle') typographyKey = 'subHeadline';
    else if (type in Typography) typographyKey = type as TypographyKey;
    else typographyKey = 'paragraph'; // Fallback to paragraph

    customStyles = {
      ...customStyles,
      ...typeStyles[typographyKey],
    };
  }

  return (
    <span style={customStyles} {...rest}>
      {children}
    </span>
  );
};
