import React from 'react';
import { Animated, Platform, Pressable as RNPressable, PressableProps as RNPressableProps, StyleProp, View, ViewStyle } from 'react-native';

export type PressableProps = RNPressableProps & {
  style?: StyleProp<ViewStyle>;
  activeOpacity?: number;
  androidRippleColor?: string;
  noFeedback?: boolean; // disables ripple/opacity feedback when true
  scaleOnPress?: number; // scale value when pressed (e.g. 0.97 for slight squeeze)
  pressedStyle?: StyleProp<ViewStyle>; // additional style applied when pressed
};

const Pressable = React.forwardRef<View, PressableProps>(
  ({ style, children, disabled, activeOpacity = 0.6, androidRippleColor, android_ripple, noFeedback = false, scaleOnPress, pressedStyle, ...rest }, ref) => {
    const ripple = noFeedback ? undefined : (android_ripple ?? (Platform.OS === 'android' ? { color: androidRippleColor ?? 'rgba(255, 255, 255, 0.08)', foreground: true } : undefined));
    const scaleAnim = React.useMemo(() => new Animated.Value(1), []);
    const [isPressed, setIsPressed] = React.useState(false);

    const handlePressIn = () => {
      setIsPressed(true);
      if (scaleOnPress && !disabled) {
        Animated.spring(scaleAnim, {
          toValue: scaleOnPress,
          useNativeDriver: true,
          speed: 50,
          bounciness: 4,
        }).start();
      }
    };

    const handlePressOut = () => {
      setIsPressed(false);
      if (scaleOnPress && !disabled) {
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          speed: 50,
          bounciness: 4,
        }).start();
      }
    };

    if (scaleOnPress || pressedStyle) {
      return (
        <RNPressable ref={ref} android_ripple={ripple} disabled={disabled} onPressIn={handlePressIn} onPressOut={handlePressOut} {...rest}>
          <Animated.View style={[typeof style === 'function' ? undefined : style, scaleOnPress ? { transform: [{ scale: scaleAnim }] } : undefined, isPressed && !disabled ? pressedStyle : undefined]}>
            {typeof children === 'function' ? null : children}
          </Animated.View>
        </RNPressable>
      );
    }

    return (
      <RNPressable
        ref={ref}
        android_ripple={ripple}
        disabled={disabled}
        style={(state) => {
          const resolvedStyle = typeof style === 'function' ? style(state) : style;
          const pressedStyle = !noFeedback && state.pressed && !disabled ? { opacity: activeOpacity } : null;
          return [resolvedStyle, pressedStyle];
        }}
        {...rest}
      >
        {children}
      </RNPressable>
    );
  }
);

Pressable.displayName = 'Pressable';

export default Pressable;
