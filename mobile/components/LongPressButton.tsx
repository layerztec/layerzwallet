import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View, Animated, Text, Easing, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';

interface LongPressButtonProps {
  onLongPressComplete: () => void;
  title: string;
  duration?: number; // in milliseconds
  disabled?: boolean;
  isLoading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  progressColor?: string;
  backgroundColor?: string;
}

const LongPressButton: React.FC<LongPressButtonProps> = ({
  onLongPressComplete,
  title,
  duration = 2_000,
  disabled = false,
  isLoading = false,
  style,
  textStyle,
  progressColor = '#007AFF',
  backgroundColor = '#2C2C2E',
}) => {
  const [pressing, setPressing] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // Reset animation when disabled changes
  useEffect(() => {
    if (disabled) {
      resetProgress();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  const startProgress = () => {
    setPressing(true);
    progressAnim.setValue(0);

    progressAnimation.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: duration,
      easing: Easing.linear,
      useNativeDriver: false,
    });

    progressAnimation.current.start();

    longPressTimer.current = setTimeout(() => {
      if (!disabled) {
        onLongPressComplete();
      }
      resetProgress();
    }, duration);
  };

  const resetProgress = () => {
    setPressing(false);
    if (progressAnimation.current) {
      progressAnimation.current.stop();
    }
    progressAnim.setValue(0);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={[styles.button, { backgroundColor }, disabled ? styles.disabled : null, style]}
      onPressIn={disabled || isLoading ? undefined : startProgress}
      onPressOut={resetProgress}
      disabled={disabled || isLoading}
    >
      <View style={styles.contentContainer}>{isLoading ? <ActivityIndicator color="white" /> : <Text style={[styles.buttonText, textStyle]}>{title}</Text>}</View>

      {pressing && <Animated.View style={[styles.progressBar, { width: progressWidth, backgroundColor: progressColor }]} />}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    marginVertical: 10,
  },
  contentContainer: {
    zIndex: 2,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  progressBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    opacity: 0.5,
    zIndex: 1,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default LongPressButton;
