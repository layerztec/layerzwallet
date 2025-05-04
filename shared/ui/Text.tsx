import React from 'react';
import { useLayerzTheme, spacing, typography } from '../themes/theme';

export const Text: React.FC<{
  children: React.ReactNode;
  variant?: 'body' | 'caption' | 'heading' | 'title' | 'subtitle';
  style?: React.CSSProperties;
}> = ({ children, variant = 'body', style }) => {
  const theme = useLayerzTheme();

  let textStyle: React.CSSProperties = {
    color: theme.text,
    margin: 0,
  };

  switch (variant) {
    case 'title':
      textStyle = {
        ...textStyle,
        fontSize: typography.fontSizes.xxl,
        fontWeight: typography.fontWeights.bold,
        marginBottom: spacing.sm,
      };
      break;
    case 'subtitle':
      textStyle = {
        ...textStyle,
        fontSize: typography.fontSizes.lg,
        fontWeight: typography.fontWeights.medium,
        marginBottom: spacing.sm,
      };
      break;
    case 'heading':
      textStyle = {
        ...textStyle,
        fontSize: typography.fontSizes.xl,
        fontWeight: typography.fontWeights.semiBold,
        marginBottom: spacing.sm,
      };
      break;
    case 'caption':
      textStyle = {
        ...textStyle,
        fontSize: typography.fontSizes.xs,
        color: theme.textSecondary,
      };
      break;
    case 'body':
    default:
      textStyle = {
        ...textStyle,
        fontSize: typography.fontSizes.md,
      };
  }

  return <div style={{ ...textStyle, ...style }}>{children}</div>;
};

export default Text;
