import React from 'react';
import { Platform } from 'react-native';
import { Button as TamaguiButton, Text, styled } from 'tamagui';

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
 * CrossPlatformButton: A Tamagui-based button component that works across platforms
 *
 * This component uses Tamagui, but implements workarounds for token resolution issues.
 * It renders differently based on platform (web or native).
 *
 * NOTE: For most use cases, consider using SimpleButton instead as it avoids
 * token resolution issues entirely. Use this component only if you need
 * specific Tamagui integration.
 *
 * @example
 * <CrossPlatformButton
 *   variant="primary"
 *   size="medium"
 *   onPress={() => console.log('Button pressed')}
 * >
 *   Click Me
 * </CrossPlatformButton>
 */

// Native Button implementation using Tamagui with direct values
const StyledButton = styled(TamaguiButton, {
  // Use direct values for styling
  backgroundColor: '#3371FF', // Use direct color value instead of token
  borderRadius: 8, // Direct pixel value
  paddingVertical: 12, // Direct pixel value for padding
  paddingHorizontal: 16, // Direct pixel value for padding
  justifyContent: 'center',
  alignItems: 'center',
  shadowColor: '#000000', // Direct color value
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 3,
  // Define variants with explicit values
  variants: {
    variant: {
      primary: {
        backgroundColor: '#3371FF', // Blue
        borderColor: '#3371FF',
      },
      secondary: {
        backgroundColor: '#F5F5F5', // Light gray
        borderColor: '#E0E0E0',
      },
      danger: {
        backgroundColor: '#FF4D4F', // Red
        borderColor: '#FF4D4F',
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#3371FF',
      },
    },
    // We'll handle sizes directly in the component instead of through variants
    disabled: {
      true: {
        opacity: 0.5,
      },
    },
    fullWidth: {
      true: {
        width: '100%',
      },
    },
  } as const,
  defaultVariants: {
    variant: 'primary',
    // IMPORTANT: Remove the size defaultVariant to avoid token resolution issues
  },
});

// We won't use the styled ButtonText component at all to avoid token resolution issues
// Instead we'll use a plain Text component with inline styles

// Native implementation (for React Native)
const NativeButton: React.FC<ButtonProps> = ({ onPress, children, variant = 'primary', size = 'medium', disabled = false, isLoading = false, fullWidth = false, testID }) => {
  // Create a direct text string if children is a string
  const textContent = typeof children === 'string' ? children : children;

  // Define custom styles for different sizes
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return { paddingVertical: 8, paddingHorizontal: 12 };
      case 'large':
        return { paddingVertical: 16, paddingHorizontal: 24 };
      case 'medium':
      default:
        return { paddingVertical: 12, paddingHorizontal: 16 };
    }
  };

  // Get appropriate font size based on the size prop
  const getFontSize = () => {
    switch (size) {
      case 'small':
        return 14;
      case 'large':
        return 18;
      case 'medium':
      default:
        return 16;
    }
  };

  // Apply custom size styles directly
  const customStyles = getSizeStyles();

  return (
    <StyledButton
      variant={variant}
      // IMPORTANT: Do NOT pass the size prop to avoid token resolution
      // Instead use direct style values
      style={customStyles}
      // Explicitly set fontSize to undefined to prevent Tamagui from trying to resolve it
      fontSize={undefined}
      size={undefined}
      disabled={disabled || isLoading}
      fullWidth={fullWidth}
      onPress={onPress}
      testID={testID}
    >
      {isLoading ? (
        <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>Loading...</Text>
      ) : (
        <Text
          // Explicitly set fontSize with pixel value to avoid token resolution
          style={{
            color: variant === 'outline' ? '#3371FF' : variant === 'secondary' ? '#000000' : '#ffffff',
            fontSize: getFontSize(),
            fontWeight: 'bold',
            textAlign: 'center',
          }}
        >
          {textContent}
        </Text>
      )}
    </StyledButton>
  );
};

// Web implementation (for Chrome Extension)
const WebButton: React.FC<ButtonProps> = ({ onPress, children, variant = 'primary', size = 'medium', disabled = false, isLoading = false, fullWidth = false, testID }) => {
  // Standard styles for web using CSS-in-JS
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

  const sizeStyles: Record<string, React.CSSProperties> = {
    small: { padding: '8px 12px', fontSize: '14px' },
    medium: { padding: '12px 16px', fontSize: '16px' },
    large: { padding: '16px 24px', fontSize: '18px' },
  };

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

// CrossPlatformButton automatically selects the appropriate implementation
export const CrossPlatformButton: React.FC<ButtonProps> = (props) => {
  // Use Platform.OS to determine which implementation to use
  const isWeb = Platform.OS === 'web';

  // Log for debugging purposes
  if (__DEV__) {
    console.log(`CrossPlatformButton using ${isWeb ? 'Web' : 'Native'} implementation with size=${props.size || 'medium'}`);
    // Log props to help debug token resolution issues
    if (props.size) {
      console.log(`Button size prop: ${props.size}, type: ${typeof props.size}`);
    }
  }

  // Return the appropriate button implementation
  return isWeb ? <WebButton {...props} /> : <NativeButton {...props} />;
};

export default CrossPlatformButton;
