import React from 'react';
import { Platform, TouchableOpacity, Text, StyleSheet, View, ActivityIndicator } from 'react-native';

export type SimpleButtonProps = {
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
 * SimpleButton: A platform-agnostic button component
 *
 * This is the recommended button component to use across both
 * the Expo mobile app and Chrome extension. It doesn't rely on Tamagui
 * tokens, avoiding token resolution issues and build warnings.
 *
 * Features:
 * - Works consistently across web (Chrome extension) and native (Expo)
 * - Direct styling with explicit values instead of tokens
 * - Support for different variants, sizes, loading state, etc.
 *
 * @example
 * <SimpleButton
 *   variant="primary"
 *   size="medium"
 *   onPress={() => console.log('Button pressed')}
 * >
 *   Click Me
 * </SimpleButton>
 */
export const SimpleButton: React.FC<SimpleButtonProps> = ({ onPress, children, variant = 'primary', size = 'medium', disabled = false, isLoading = false, fullWidth = false, testID }) => {
  const getBackgroundColor = () => {
    if (disabled) return '#CCCCCC';
    switch (variant) {
      case 'primary':
        return '#3371FF';
      case 'secondary':
        return '#F5F5F5';
      case 'danger':
        return '#FF4D4F';
      case 'outline':
        return 'transparent';
      default:
        return '#3371FF';
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'secondary':
        return '#000000';
      case 'outline':
        return '#3371FF';
      default:
        return '#FFFFFF';
    }
  };

  const getPadding = () => {
    switch (size) {
      case 'small':
        return { paddingVertical: 8, paddingHorizontal: 12 };
      case 'large':
        return { paddingVertical: 16, paddingHorizontal: 24 };
      default:
        return { paddingVertical: 12, paddingHorizontal: 16 };
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'small':
        return 14;
      case 'large':
        return 18;
      default:
        return 16;
    }
  };

  const getBorder = () => {
    return variant === 'outline' ? { borderWidth: 1, borderColor: '#3371FF' } : {};
  };

  // For web (Chrome extension)
  if (Platform.OS === 'web') {
    const webStyle = {
      ...styles.button,
      ...getPadding(),
      ...getBorder(),
      backgroundColor: getBackgroundColor(),
      width: fullWidth ? '100%' : 'auto',
      opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
    };

    const textStyle = {
      ...styles.text,
      color: getTextColor(),
      fontSize: getFontSize(),
    };

    return (
      <button onClick={onPress} style={webStyle} disabled={disabled || isLoading} data-testid={testID}>
        {isLoading ? 'Loading...' : children}
      </button>
    );
  }

  // For React Native
  const buttonStyles = [styles.button, getPadding(), getBorder(), { backgroundColor: getBackgroundColor() }, fullWidth && styles.fullWidth, disabled && styles.disabled];

  const textStyle = [styles.text, { color: getTextColor(), fontSize: getFontSize() }];

  return (
    <TouchableOpacity style={buttonStyles} onPress={onPress} disabled={disabled || isLoading} testID={testID}>
      {isLoading ? <ActivityIndicator color={getTextColor()} size="small" /> : <Text style={textStyle}>{children}</Text>}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 5,
    backgroundColor: '#3371FF',
  },
  text: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
});

export default SimpleButton;
