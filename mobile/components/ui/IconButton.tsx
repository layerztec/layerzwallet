import React from 'react';
import { TouchableOpacity, Text, StyleSheet, TouchableOpacityProps, View } from 'react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import { ColorNames } from '../../../shared/theme';

export type IconButtonProps = TouchableOpacityProps & {
  icon: React.ReactNode;
  label?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'small' | 'medium' | 'large';
  colorName?: ColorNames;
};

export function IconButton({ icon, label, variant = 'primary', size = 'medium', colorName, style, ...otherProps }: IconButtonProps) {
  const primaryColor = useThemeColor({}, 'primary');
  const secondaryColor = useThemeColor({}, 'secondary');
  const dangerColor = useThemeColor({}, 'danger');
  const textColor = useThemeColor({}, 'text');

  const customColorValue = useThemeColor({}, colorName || 'primary');
  const customColor = colorName ? customColorValue : undefined;

  let btnBackgroundColor;
  let btnTextColor = 'white';
  let borderConfig = {};

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
      borderConfig = {
        borderWidth: 1,
        borderColor: customColor || primaryColor,
      };
      break;
    default:
      btnBackgroundColor = primaryColor;
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
    <TouchableOpacity style={[styles.button, sizeStyles, { backgroundColor: btnBackgroundColor }, variant === 'outline' && borderConfig, label ? styles.withLabel : {}, style]} {...otherProps}>
      <View style={styles.iconContainer}>{icon}</View>
      {label && <Text style={[styles.label, { color: btnTextColor }, size === 'small' && { fontSize: 12 }, size === 'large' && { fontSize: 16 }]}>{label}</Text>}
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
  withLabel: {
    paddingBottom: 8,
  },
  iconContainer: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButton: {
    minWidth: 40,
    minHeight: 40,
  },
  mediumButton: {
    minWidth: 48,
    minHeight: 48,
  },
  largeButton: {
    minWidth: 56,
    minHeight: 56,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
});
