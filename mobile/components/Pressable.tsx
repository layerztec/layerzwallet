import React from 'react';
import { Platform, Pressable as RNPressable, PressableProps as RNPressableProps, StyleProp, View, ViewStyle } from 'react-native';

export type PressableProps = RNPressableProps & {
  style?: StyleProp<ViewStyle>;
  activeOpacity?: number;
  androidRippleColor?: string;
  noFeedback?: boolean; // disables ripple/opacity feedback when true
};

const Pressable = React.forwardRef<View, PressableProps>(({ style, children, disabled, activeOpacity = 0.6, androidRippleColor, android_ripple, noFeedback = false, ...rest }, ref) => {
  const ripple = noFeedback ? undefined : (android_ripple ?? (Platform.OS === 'android' ? { color: androidRippleColor ?? 'rgba(255, 255, 255, 0.08)', foreground: true } : undefined));

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
});

Pressable.displayName = 'Pressable';

export default Pressable;
