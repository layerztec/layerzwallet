import React from 'react';
import { TouchableOpacity, Text, StyleSheet, TouchableOpacityProps } from 'react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import { ColorNames } from '../../../shared/theme';

export type ThemedButtonProps = TouchableOpacityProps & {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'small' | 'medium' | 'large';
  colorName?: ColorNames;
};

export function ThemedButton({ title, variant = 'primary', size = 'medium', colorName, style, ...otherProps }: ThemedButtonProps) {
  const primaryColor = useThemeColor({}, 'primary');
  const secondaryColor = useThemeColor({}, 'secondary');
  const dangerColor = useThemeColor({}, 'danger');
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'buttonBackground');

  const customColorValue = useThemeColor({}, colorName || 'primary');
  const customColor = colorName ? customColorValue : undefined;

  let btnBackgroundColor;
  let btnTextColor = 'white';

  switch (variant) {
    case 'primary':
      btnBackgroundColor = customColor || primaryColor;
      break;
    case 'secondary':
      btnBackgroundColor = secondaryColor;
      break;
    case 'danger':
      btnBackgroundColor = dangerColor;
      break;
    case 'outline':
      btnBackgroundColor = 'transparent';
      btnTextColor = customColor || textColor;
      break;
    default:
      btnBackgroundColor = backgroundColor;
  }

  let sizeStyles;
  switch (size) {
    case 'small':
      sizeStyles = styles.smallButton;
      break;
    case 'large':
      sizeStyles = styles.largeButton;
      break;
    default:
      sizeStyles = styles.mediumButton;
  }

  return (
    <TouchableOpacity
      style={[styles.button, sizeStyles, { backgroundColor: btnBackgroundColor }, variant === 'outline' && { borderWidth: 1, borderColor: customColor || primaryColor }, style]}
      {...otherProps}
    >
      <Text style={[styles.text, { color: btnTextColor }, variant === 'outline' && { color: customColor || primaryColor }, size === 'small' && { fontSize: 14 }, size === 'large' && { fontSize: 18 }]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  smallButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  mediumButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  largeButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  text: {
    fontWeight: '600',
    fontSize: 16,
  },
});
