// ...Button component logic from DesignSystem and platform-specific logic...
// This file should export a Button component that uses the shared useTheme hook and adapts to web/mobile as needed.
// For now, use the web implementation from DesignSystem, but refactor to allow platform-specific logic if needed.

import React from 'react';
import { useLayerzTheme, spacing, borderRadius, typography } from '../themes/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'send' | 'receive';
export type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  iconName?: string;
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', size = 'medium', disabled, style, iconName, ...props }) => {
  const theme = useLayerzTheme();
  const [pressed, setPressed] = React.useState(false);

  // ...getVariantStyles and getSizeStyles logic from DesignSystem...
  const getVariantStyles = (): { backgroundColor: string; textColor: string; borderColor?: string } => {
    switch (variant) {
      case 'primary':
        return { backgroundColor: theme.primary, textColor: theme.white };
      case 'secondary':
        return { backgroundColor: theme.secondary, textColor: theme.white };
      case 'danger':
        return { backgroundColor: theme.error, textColor: theme.white };
      case 'success':
        return { backgroundColor: theme.success, textColor: theme.white };
      case 'outline':
        return { backgroundColor: 'transparent', textColor: theme.primary, borderColor: theme.primary };
      case 'send':
        return { backgroundColor: theme.send, textColor: theme.white };
      case 'receive':
        return { backgroundColor: theme.receive, textColor: theme.white };
      default:
        return { backgroundColor: theme.primary, textColor: theme.white };
    }
  };

  const getSizeStyles = (): { height: string; padding: string; fontSize: string; iconSize: number } => {
    switch (size) {
      case 'small':
        return { height: '36px', padding: `${spacing.xs}px ${spacing.sm}px`, fontSize: `${typography.fontSizes.sm}px`, iconSize: 16 };
      case 'medium':
        return { height: '48px', padding: `${spacing.sm}px ${spacing.md}px`, fontSize: `${typography.fontSizes.md}px`, iconSize: 18 };
      case 'large':
        return { height: '56px', padding: `${spacing.sm}px ${spacing.lg}px`, fontSize: `${typography.fontSizes.lg}px`, iconSize: 22 };
      default:
        return { height: '48px', padding: `${spacing.sm}px ${spacing.md}px`, fontSize: `${typography.fontSizes.md}px`, iconSize: 18 };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  return (
    <button
      {...props}
      disabled={disabled}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        backgroundColor: variantStyles.backgroundColor,
        color: variantStyles.textColor,
        border: variantStyles.borderColor ? `1px solid ${variantStyles.borderColor}` : 'none',
        borderRadius: borderRadius.md,
        height: sizeStyles.height,
        padding: sizeStyles.padding,
        fontSize: sizeStyles.fontSize,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'opacity 0.2s',
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </button>
  );
};

export default Button;
