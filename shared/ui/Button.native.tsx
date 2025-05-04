import React from 'react';
import { Pressable, Text, ActivityIndicator, StyleSheet, View, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../../mobile/hooks/ThemeContext';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'send' | 'receive';
export type ButtonSize = 'small' | 'medium' | 'large';
export type IconPosition = 'left' | 'right';

interface ButtonProps {
  onPress: () => void;
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
  iconName?: string;
  iconPosition?: IconPosition;
  iconOnly?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  onPress,
  title,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
  testID,
  iconName,
  iconPosition = 'left',
  iconOnly = false,
  ...rest
}) => {
  const { getColor } = useTheme();

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return { backgroundColor: getColor('primary'), textColor: getColor('white') };
      case 'secondary':
        return { backgroundColor: getColor('accent'), textColor: getColor('white') };
      case 'danger':
        return { backgroundColor: getColor('error'), textColor: getColor('white') };
      case 'success':
        return { backgroundColor: getColor('success'), textColor: getColor('white') };
      case 'outline':
        return { backgroundColor: 'transparent', textColor: getColor('primary'), borderColor: getColor('primary') };
      case 'send':
        return { backgroundColor: getColor('sendButton'), textColor: getColor('white') };
      case 'receive':
        return { backgroundColor: getColor('receiveButton'), textColor: getColor('white') };
      default:
        return { backgroundColor: getColor('primary'), textColor: getColor('white') };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return { height: 36, paddingHorizontal: 16, fontSize: 14 };
      case 'medium':
        return { height: 48, paddingHorizontal: 24, fontSize: 16 };
      case 'large':
        return { height: 56, paddingHorizontal: 32, fontSize: 18 };
      default:
        return { height: 48, paddingHorizontal: 24, fontSize: 16 };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: variantStyles.backgroundColor,
          height: sizeStyles.height,
          paddingHorizontal: iconOnly ? 12 : sizeStyles.paddingHorizontal,
          borderColor: variantStyles.borderColor || variantStyles.backgroundColor,
          borderWidth: variant === 'outline' ? 1 : 0,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles.textColor} size="small" />
      ) : (
        <View style={styles.contentContainer}>{!iconOnly && <Text style={[styles.text, { color: variantStyles.textColor, fontSize: sizeStyles.fontSize }, textStyle]}>{title}</Text>}</View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default Button;
export { Button };
