import React from 'react';
import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/ThemeContext';
import Button from '../../../shared/ui/Button';

export type ActionType = 'send' | 'receive' | 'swap' | 'buy' | 'sell';

interface ActionButtonProps {
  type: ActionType;
  onPress: () => void;
  label?: string;
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
}

/**
 * A specialized button component for common wallet actions
 * Includes standardized colors and icons for each action type
 */
export default function ActionButton({ type, onPress, label, size = 'medium', style, textStyle, disabled = false, loading = false, testID }: ActionButtonProps) {
  const { getColor } = useTheme();

  // Determine the button's configuration based on its type
  const getActionConfig = () => {
    switch (type) {
      case 'send':
        return {
          color: getColor('sendButton'),
          icon: 'arrow-up-outline',
          defaultLabel: 'Send',
        };
      case 'receive':
        return {
          color: getColor('receiveButton'),
          icon: 'arrow-down-outline',
          defaultLabel: 'Receive',
        };
      case 'swap':
        return {
          color: getColor('primary'),
          icon: 'swap-horizontal-outline',
          defaultLabel: 'Swap',
        };
      case 'buy':
        return {
          color: getColor('success'),
          icon: 'add-circle-outline',
          defaultLabel: 'Buy',
        };
      case 'sell':
        return {
          color: getColor('warning'),
          icon: 'cash-outline',
          defaultLabel: 'Sell',
        };
      default:
        return {
          color: getColor('primary'),
          icon: 'ellipsis-horizontal',
          defaultLabel: 'Action',
        };
    }
  };

  const config = getActionConfig();
  const buttonLabel = label === undefined ? config.defaultLabel : label;
  const iconSize = size === 'small' ? 16 : size === 'medium' ? 18 : 22;

  // For icon-only buttons (when label is empty string), adjust the style
  const isIconOnly = label === '';
  const iconOnlyStyle = isIconOnly ? { paddingHorizontal: 8 } : {};

  return (
    <Button
      title={buttonLabel}
      onPress={onPress}
      style={[styles.button, { backgroundColor: config.color }, iconOnlyStyle, style]}
      textStyle={[styles.buttonText, textStyle]}
      disabled={disabled}
      loading={loading}
      testID={testID}
      size={size}
      iconLeft={<Ionicons name={config.icon} size={iconSize} color={getColor('white')} style={isIconOnly ? {} : styles.icon} />}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
  },
  buttonText: {
    fontWeight: 'bold',
  },
  icon: {
    marginRight: 8,
  },
});
