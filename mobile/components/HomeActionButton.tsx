import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, TextStyle, View, ViewStyle } from 'react-native';
import Pressable, { PressableProps } from './Pressable';
import { ThemedText } from './ThemedText';

type IconConfig =
  | { name: React.ComponentProps<typeof MaterialIcons>['name']; type: 'material'; size?: number }
  | { name: React.ComponentProps<typeof Ionicons>['name']; type?: 'ionicons'; size?: number };

export interface HomeActionButtonProps extends PressableProps {
  title: string;
  icon?: IconConfig;
  variant?: 'light' | 'dark';
  loading?: boolean;
  textStyle?: TextStyle;
}

export default function HomeActionButton({ title, icon, onPress, variant = 'light', disabled = false, loading = false, style, textStyle, activeOpacity = 0.8, ...restProps }: HomeActionButtonProps) {
  const getButtonStyle = (): StyleProp<ViewStyle> => {
    const baseStyle: ViewStyle[] = [styles.button];

    if (disabled) {
      baseStyle.push(styles.disabled);
    }

    if (style) {
      return StyleSheet.compose(baseStyle, style);
    }

    return baseStyle;
  };

  const getTextStyle = (): TextStyle[] => {
    const baseTextStyle: TextStyle[] = [styles.buttonText];

    if (textStyle) {
      baseTextStyle.push(textStyle);
    }

    return baseTextStyle;
  };

  const renderIcon = () => {
    if (!icon) return null;

    const iconSize = icon.size || 24;
    const iconColor = 'rgba(255, 255, 255, 0.8)';

    if (icon.type === 'material') {
      return <MaterialIcons name={icon.name} size={iconSize} color={iconColor} style={styles.icon} />;
    }
    return <Ionicons name={icon.name} size={iconSize} color={iconColor} style={styles.icon} />;
  };

  const renderContent = () => {
    if (loading) {
      return <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.8)" />;
    }

    return renderIcon();
  };

  const surfaceStyle = variant === 'light' ? styles.surfaceLight : styles.surfaceDark;

  return (
    <View style={styles.buttonContainer}>
      <View style={styles.buttonWrapper}>
        <Pressable style={getButtonStyle()} onPress={onPress} disabled={disabled || loading} activeOpacity={activeOpacity} {...restProps}>
          <View style={[styles.surface, surfaceStyle]}>{renderContent()}</View>
        </Pressable>
      </View>
      <View style={styles.textContainer}>
        <ThemedText style={getTextStyle()}>{title}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonContainer: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    maxWidth: '100%',
    alignItems: 'center',
  },
  buttonWrapper: {
    width: '100%',
  },
  button: {
    width: '100%',
    height: 54,
  },
  textContainer: {
    width: '100%',
    marginTop: 8,
    alignItems: 'center',
  },
  surface: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    overflow: 'hidden',
  },
  surfaceLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  surfaceDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: -0.26,
    textAlign: 'center',
  },
  icon: {
    marginRight: 0,
  },
  disabled: {
    opacity: 0.3,
  },
});
