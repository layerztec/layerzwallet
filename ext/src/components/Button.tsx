import React from 'react';

// Try to import the cross-platform Button component
let CrossPlatformButton: React.FC<any> | null = null;
try {
  // Dynamic import to handle potential errors
  CrossPlatformButton = require('../../../shared/components/CrossPlatformButton').CrossPlatformButton;
} catch (error) {
  console.log('Could not import cross-platform Button component, using fallback implementation');
  CrossPlatformButton = null;
}

export type ButtonProps = {
  onPress?: () => void;
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  isLoading?: boolean;
  fullWidth?: boolean;
  testID?: string;
};

/**
 * Extension implementation of the Button component.
 * First tries to use the shared Tamagui Button component.
 * Falls back to a simplified version that matches the shared Button API but
 * uses standard CSS styles if there are any issues with Tamagui in the extension.
 */
export const Button: React.FC<ButtonProps> = (props) => {
  const { onPress, children, variant = 'primary', size = 'medium', disabled = false, isLoading = false, fullWidth = false, testID } = props;
  
  // If we successfully imported the cross-platform Button, try to use it
  if (CrossPlatformButton) {
    try {
      return <CrossPlatformButton {...props} />;
    } catch (error) {
      console.log('Error using cross-platform Button component, falling back to custom implementation', error);
      // Continue to fallback implementation below
    }
  }
  
  // Fallback implementation using standard HTML/CSS
  // CSS classes based on props
  const baseStyle: React.CSSProperties = {
    borderRadius: '8px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    fontWeight: 500,
    display: 'inline-flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: fullWidth ? '100%' : 'auto',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  };

  // Size styles
  const sizeStyles: Record<string, React.CSSProperties> = {
    small: { padding: '8px 12px', fontSize: '14px' },
    medium: { padding: '12px 16px', fontSize: '16px' },
    large: { padding: '16px 24px', fontSize: '18px' },
  };

  // Variant styles
  const variantStyles: Record<string, React.CSSProperties> = {
    primary: { backgroundColor: '#3371FF', color: 'white', border: 'none' },
    secondary: { backgroundColor: '#F5F5F5', color: '#333333', border: 'none' },
    danger: { backgroundColor: '#FF4D4F', color: 'white', border: 'none' },
    outline: { backgroundColor: 'transparent', color: '#3371FF', border: '1px solid #3371FF' },
  };

  const combinedStyle = {
    ...baseStyle,
    ...sizeStyles[size],
    ...variantStyles[variant],
  };

  const handleClick = () => {
    if (!disabled && !isLoading && onPress) {
      onPress();
    }
  };

  return (
    <button onClick={handleClick} style={combinedStyle} disabled={disabled} data-testid={testID}>
      {isLoading ? 'Loading...' : children}
    </button>
  );
};

export default Button;
