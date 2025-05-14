import React from 'react';
import { StyleSheet, TouchableOpacity, Text } from 'react-native';
import { ReactNativeThemedButtonProps } from '@shared/ui/components/ThemedButton';

export const ThemedButton: React.FC<ReactNativeThemedButtonProps> = ({
  onPress,
  disabled,
  style,
  testID,
  color = '#007AFF',
  textColor = 'white',
  children,
  icon,
  iconPosition = 'left',
  activeOpacity = 0.7,
  accessibilityLabel,
  size = 'medium',
  variant = 'solid',
  fullWidth,
  ...props
}) => {
  let variantStyle = {};
  if (variant === 'outline') {
    variantStyle = {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: color,
    };
  } else if (variant === 'ghost') {
    variantStyle = {
      backgroundColor: 'transparent',
    };
  }

  // Handle size styles
  let sizeStyle = {};
  if (size === 'small') {
    sizeStyle = {
      height: 36,
      paddingHorizontal: 12,
    };
  } else if (size === 'large') {
    sizeStyle = {
      height: 56,
      paddingHorizontal: 24,
    };
  }

  let widthStyle = fullWidth ? { width: '100%' } : {};

  const buttonStyle = [styles.button, variant === 'solid' && { backgroundColor: color }, sizeStyle, variantStyle, widthStyle, disabled && styles.disabled, style];

  let variantTextColor = textColor;
  if (variant === 'outline' || variant === 'ghost') {
    variantTextColor = color;
  }

  let textSizeStyle = {};
  if (size === 'small') {
    textSizeStyle = { fontSize: 14 };
  } else if (size === 'large') {
    textSizeStyle = { fontSize: 18 };
  }

  const textStyle = [styles.buttonText, { color: variantTextColor }, textSizeStyle, disabled && styles.disabledText];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={buttonStyle}
      testID={testID}
      activeOpacity={activeOpacity}
      accessibilityLabel={accessibilityLabel || (typeof children === 'string' ? children : undefined)}
      accessibilityRole="button"
      {...props}
    >
      <React.Fragment>
        {iconPosition === 'left' && icon}

        {typeof children === 'string' ? (
          <Text style={[textStyle, icon && iconPosition === 'left' ? { marginLeft: 8 } : null, icon && iconPosition === 'right' ? { marginRight: 8 } : null]}>{children}</Text>
        ) : (
          children
        )}

        {iconPosition === 'right' && icon}
      </React.Fragment>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    height: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabled: {
    opacity: 0.5,
  },
  disabledText: {
    opacity: 0.7,
  },
});

export default ThemedButton;
