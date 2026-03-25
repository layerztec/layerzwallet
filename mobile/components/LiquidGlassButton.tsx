import React from 'react';
import { StyleSheet, ActivityIndicator, View, TextStyle, StyleProp, ViewStyle } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import Pressable, { PressableProps } from './Pressable';
import LiquidGlassView from './LiquidGlassView';
import { ThemedText } from './ThemedText';

type IconConfig =
  | { name: React.ComponentProps<typeof MaterialIcons>['name']; type: 'material'; size?: number }
  | { name: React.ComponentProps<typeof Ionicons>['name']; type?: 'ionicons'; size?: number };

export interface LiquidGlassButtonProps extends PressableProps {
  title: string;
  icon?: IconConfig;
  variant?: 'light' | 'dark';
  loading?: boolean;
  textStyle?: TextStyle;
  glassStyle?: 'clear' | 'regular';
}

export default function LiquidGlassButton({
  title,
  icon,
  onPress,
  variant = 'light',
  disabled = false,
  loading = false,
  style,
  textStyle,
  activeOpacity = 0.8,
  glassStyle = 'clear',
  ...restProps
}: LiquidGlassButtonProps) {
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

  // Use 'light' for light variant to get a lighter appearance
  const tint = variant === 'light' ? 'light' : 'dark';

  return (
    <View style={styles.buttonContainer}>
      <View style={styles.buttonWrapper}>
        <Pressable style={getButtonStyle()} onPress={onPress} disabled={disabled || loading} activeOpacity={activeOpacity} {...restProps}>
          <LiquidGlassView tint={tint} glassStyle={glassStyle} intensity={1} borderIntensity={0.2} style={styles.glassContainer}>
            {renderContent()}
          </LiquidGlassView>
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
    flexBasis: 0, // Critical: ensures equal starting size
    minWidth: 0, // Critical: allows shrinking below content size
    maxWidth: '100%', // Prevents growing beyond allocated space
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
  glassContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'transparent',
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
