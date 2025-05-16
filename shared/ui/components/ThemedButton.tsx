import React from 'react';

export const WebThemedButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    disabled?: boolean;
    color?: string;
    textColor?: string;
    icon?: React.ReactNode;
    iconPosition?: 'left' | 'right';
    ariaLabel?: string; // For web accessibility
    size?: 'small' | 'medium' | 'large';
    variant?: 'solid' | 'outline' | 'ghost';
    fullWidth?: boolean;
  }
> = ({ children, disabled, style, color = '#007AFF', textColor = 'white', icon, iconPosition = 'left', ariaLabel, size = 'medium', variant = 'solid', fullWidth, ...props }) => {
  let backgroundColor = color;
  let borderStyle = 'none';
  let buttonTextColor = textColor;

  if (variant === 'outline') {
    backgroundColor = 'transparent';
    borderStyle = `1px solid ${color}`;
    buttonTextColor = color;
  } else if (variant === 'ghost') {
    backgroundColor = 'transparent';
    buttonTextColor = color;
  }

  let padding = '10px 20px';
  let fontSize = '16px';

  if (size === 'small') {
    padding = '6px 12px';
    fontSize = '14px';
  } else if (size === 'large') {
    padding = '14px 28px';
    fontSize = '18px';
  }

  const width = fullWidth ? '100%' : 'auto';

  return (
    <button
      {...props}
      disabled={disabled}
      aria-label={ariaLabel || (typeof children === 'string' ? children : undefined)}
      style={{
        backgroundColor,
        color: buttonTextColor,
        border: borderStyle,
        padding,
        borderRadius: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize,
        transition: 'all 0.3s',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        whiteSpace: 'nowrap',
        margin: '0 5px 5px 0',
        width,
        ...style,
      }}
    >
      {iconPosition === 'left' && icon && <span style={{ display: 'flex', alignItems: 'center', marginRight: '8px' }}>{icon}</span>}
      {typeof children === 'string' ? <span>{children}</span> : React.Children.map(children, (child) => <span style={{ display: 'flex', alignItems: 'center' }}>{child}</span>)}
      {iconPosition === 'right' && icon && <span style={{ display: 'flex', alignItems: 'center', marginLeft: '8px' }}>{icon}</span>}
    </button>
  );
};

export interface ReactNativeThemedButtonProps {
  onPress?: () => void;
  disabled?: boolean;
  style?: any;
  testID?: string;
  color?: string;
  textColor?: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  activeOpacity?: number;
  accessibilityLabel?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'solid' | 'outline' | 'ghost';
  fullWidth?: boolean;
  [key: string]: any;
}

export const ReactNativeThemedButton: React.FC<ReactNativeThemedButtonProps> = ({ children, ...props }) => {
  return null;
};

export const ThemedButton = typeof window !== 'undefined' && typeof document !== 'undefined' ? WebThemedButton : ReactNativeThemedButton;

export default ThemedButton;
