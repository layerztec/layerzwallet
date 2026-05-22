import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, TextStyle, View, ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Pressable, { PressableProps } from './Pressable';
import { ThemedText } from './ThemedText';

// Bitcoin orange — warm accent that stays visible on every network background gradient.
const GLOW_COLOR = '#F7931A';
// Breathing glow opacity range — floors above 0 so the halo stays continuously visible.
const GLOW_MIN = 0.3;
const GLOW_MAX = 0.62;
const GLOW_DURATION = 2400; // ms per half-cycle — slow, calm breathing

type IconConfig =
  | { name: React.ComponentProps<typeof MaterialIcons>['name']; type: 'material'; size?: number }
  | { name: React.ComponentProps<typeof Ionicons>['name']; type?: 'ionicons'; size?: number };

export interface HomeActionButtonProps extends PressableProps {
  title: string;
  icon?: IconConfig;
  variant?: 'light' | 'dark';
  loading?: boolean;
  textStyle?: TextStyle;
  /** When true, renders a soft breathing glow halo behind the button to draw attention. */
  glow?: boolean;
}

export default function HomeActionButton({
  title,
  icon,
  onPress,
  variant = 'light',
  disabled = false,
  loading = false,
  style,
  textStyle,
  activeOpacity = 0.8,
  glow = false,
  ...restProps
}: HomeActionButtonProps) {
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    if (glow) {
      // Start dim, then repeat reversed so opacity oscillates GLOW_MIN <-> GLOW_MAX forever.
      glowOpacity.value = GLOW_MIN;
      glowOpacity.value = withRepeat(withTiming(GLOW_MAX, { duration: GLOW_DURATION, easing: Easing.inOut(Easing.ease) }), -1, true);
    } else {
      cancelAnimation(glowOpacity);
      glowOpacity.value = withTiming(0, { duration: 300 });
    }
    return () => cancelAnimation(glowOpacity);
  }, [glow, glowOpacity]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

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
        {glow ? <Animated.View pointerEvents="none" style={[styles.glow, glowStyle]} /> : null}
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
  glow: {
    position: 'absolute',
    top: -9,
    left: -9,
    right: -9,
    bottom: -9,
    borderRadius: 36,
    backgroundColor: GLOW_COLOR,
    shadowColor: GLOW_COLOR,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 10,
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
