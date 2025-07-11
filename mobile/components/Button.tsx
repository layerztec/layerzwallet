import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { ThemedText } from './ThemedText';

type ButtonType = 'primary' | 'secondary';

interface ButtonProps {
  type?: ButtonType;
  onPress: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const Button: React.FC<ButtonProps> = ({ type = 'primary', onPress, children, disabled = false, style, testID }) => {
  const buttonStyle = [styles.base, styles[type], disabled && styles.disabled, style];

  return (
    <TouchableOpacity style={buttonStyle} onPress={onPress} disabled={disabled} testID={testID} activeOpacity={0.8}>
      <ThemedText style={[styles.text, styles[`${type}Text`]]}>{children}</ThemedText>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    height: 56,
    paddingHorizontal: 16,
  },
  primary: {
    backgroundColor: '#000000',
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    textAlign: 'center',
  },
  primaryText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  secondaryText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
});

export default Button;
