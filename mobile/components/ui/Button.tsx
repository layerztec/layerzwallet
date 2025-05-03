import React, { ReactNode } from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle, View } from 'react-native';
import { useTheme } from '@/hooks/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

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

/**
 * A standardized button component for use across the app
 * Uses the shared theme system for consistent styling
 */
export default function Button({
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
}: ButtonProps) {
  const { getColor } = useTheme();

  // Define styles based on variant
  const getVariantStyles = (): { backgroundColor: string; textColor: string; borderColor?: string } => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: getColor('primary'),
          textColor: getColor('white'),
        };
      case 'secondary':
        return {
          backgroundColor: getColor('accent'),
          textColor: getColor('white'),
        };
      case 'danger':
        return {
          backgroundColor: getColor('error'),
          textColor: getColor('white'),
        };
      case 'success':
        return {
          backgroundColor: getColor('success'),
          textColor: getColor('white'),
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          textColor: getColor('primary'),
          borderColor: getColor('primary'),
        };
      case 'send':
        return {
          backgroundColor: getColor('sendButton'),
          textColor: getColor('white'),
        };
      case 'receive':
        return {
          backgroundColor: getColor('receiveButton'),
          textColor: getColor('white'),
        };
      default:
        return {
          backgroundColor: getColor('primary'),
          textColor: getColor('white'),
        };
    }
  };

  // Define styles based on size
  const getSizeStyles = (): { height: number; paddingHorizontal: number; fontSize: number; iconSize: number } => {
    switch (size) {
      case 'small':
        return {
          height: 36,
          paddingHorizontal: 16,
          fontSize: 14,
          iconSize: 16,
        };
      case 'medium':
        return {
          height: 48,
          paddingHorizontal: 24,
          fontSize: 16,
          iconSize: 18,
        };
      case 'large':
        return {
          height: 56,
          paddingHorizontal: 32,
          fontSize: 18,
          iconSize: 22,
        };
      default:
        return {
          height: 48,
          paddingHorizontal: 24,
          fontSize: 16,
          iconSize: 18,
        };
    }
  };

  // Get the icon name based on variant if not explicitly provided
  const getIconForVariant = () => {
    if (iconName) return iconName;

    switch (variant) {
      case 'send':
        return 'arrow-up-outline';
      case 'receive':
        return 'arrow-down-outline';
      default:
        return '';
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();
  const icon = getIconForVariant();

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
    >
      {loading ? (
        <ActivityIndicator color={variantStyles.textColor} size="small" />
      ) : (
        <View style={styles.contentContainer}>
          {icon && iconPosition === 'left' && !iconOnly && <Ionicons name={icon} size={sizeStyles.iconSize} color={variantStyles.textColor} style={styles.iconLeft} />}

          {icon && iconOnly && <Ionicons name={icon} size={sizeStyles.iconSize} color={variantStyles.textColor} />}

          {!iconOnly && (
            <Text
              style={[
                styles.text,
                {
                  color: variantStyles.textColor,
                  fontSize: sizeStyles.fontSize,
                },
                textStyle,
              ]}
            >
              {title}
            </Text>
          )}

          {icon && iconPosition === 'right' && !iconOnly && <Ionicons name={icon} size={sizeStyles.iconSize} color={variantStyles.textColor} style={styles.iconRight} />}
        </View>
      )}
    </Pressable>
  );
}

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
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});
