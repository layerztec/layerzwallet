import React from 'react';
import { Button as TamaguiButton, Text, styled } from 'tamagui';
import { Platform } from 'react-native';

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

const StyledButton = styled(TamaguiButton, {
  backgroundColor: '$blue10',
  borderRadius: 8,
  paddingVertical: 12,
  paddingHorizontal: 16,
  justifyContent: 'center',
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 3,
  variants: {
    variant: {
      primary: {
        backgroundColor: '$blue10',
      },
      secondary: {
        backgroundColor: '$gray5',
      },
      danger: {
        backgroundColor: '$red10',
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '$blue10',
      },
    },
    size: {
      small: {
        paddingVertical: 8,
        paddingHorizontal: 12,
      },
      medium: {
        paddingVertical: 12,
        paddingHorizontal: 16,
      },
      large: {
        paddingVertical: 16,
        paddingHorizontal: 24,
      },
    },
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
    size: 'medium',
  },
});

const ButtonText = styled(Text, {
  color: '#fff',
  fontWeight: 'bold',
  fontSize: 16,
  textAlign: 'center',
  variants: {
    variant: {
      primary: {
        color: '#fff',
      },
      secondary: {
        color: '#000',
      },
      danger: {
        color: '#fff',
      },
      outline: {
        color: '$blue10',
      },
    },
    size: {
      small: {
        fontSize: 14,
      },
      medium: {
        fontSize: 16,
      },
      large: {
        fontSize: 18,
      },
    },
    disabled: {
      true: {
        opacity: 0.7,
      },
    },
  } as const,
});

export const Button: React.FC<ButtonProps> = ({ onPress, children, variant = 'primary', size = 'medium', disabled = false, isLoading = false, fullWidth = false, testID }) => {
  // Check if we're running in a web environment (Chrome extension)
  const isWeb = Platform.OS === 'web';

  // Web platform may have special handling or optimizations
  if (isWeb) {
    // Use Tamagui for web, but with potential web-specific optimizations
    return (
      <StyledButton
        variant={variant}
        size={size}
        disabled={disabled || isLoading}
        fullWidth={fullWidth}
        onPress={onPress}
        testID={testID}
        // Add some web-specific props that might help with Chrome extension
        accessibilityLabel={typeof children === 'string' ? children : undefined}
      >
        {isLoading ? (
          <Text>Loading...</Text>
        ) : (
          <ButtonText variant={variant} size={size} disabled={disabled}>
            {children}
          </ButtonText>
        )}
      </StyledButton>
    );
  }

  // Mobile platform (default behavior)
  return (
    <StyledButton variant={variant} size={size} disabled={disabled || isLoading} fullWidth={fullWidth} onPress={onPress} testID={testID}>
      {isLoading ? (
        <Text>Loading...</Text>
      ) : (
        <ButtonText variant={variant} size={size} disabled={disabled}>
          {children}
        </ButtonText>
      )}
    </StyledButton>
  );
};

export default Button;
