import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, ActivityIndicator, TextStyle, ViewStyle } from 'react-native';

interface LongPressButtonProps {
  /**
   * Function to execute when long press is completed
   */
  onLongPressComplete: () => void;

  /**
   * Time in ms to hold for completion (default: 1500ms)
   */
  duration?: number;

  /**
   * Button text
   */
  title: string;

  /**
   * Background color of the button
   */
  backgroundColor?: string;

  /**
   * Color of the progress bar
   */
  progressColor?: string;

  /**
   * Custom styles for the button
   */
  style?: ViewStyle;

  /**
   * Custom styles for the button text
   */
  textStyle?: TextStyle;

  /**
   * Disabled state
   */
  disabled?: boolean;

  /**
   * Loading state
   */
  isLoading?: boolean;
}

/**
 * A button that requires a long press to activate, with visual progress feedback
 */
const LongPressButton: React.FC<LongPressButtonProps> = ({
  onLongPressComplete,
  duration = 1500,
  title,
  backgroundColor = '#007AFF',
  progressColor = '#005BB5',
  style,
  textStyle,
  disabled = false,
  isLoading = false,
}) => {
  const [pressing, setPressing] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const startProgress = () => {
    setPressing(true);
    progress.setValue(0);

    Animated.timing(progress, {
      toValue: 100,
      duration,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && pressing) {
        onLongPressComplete();
        resetProgress();
      }
    });

    // Safety timeout in case the animation callback doesn't fire
    timerRef.current = setTimeout(() => {
      if (pressing) {
        onLongPressComplete();
        resetProgress();
      }
    }, duration + 50);
  };

  const resetProgress = () => {
    setPressing(false);
    progress.setValue(0);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const progressWidth = progress.interpolate({
    inputRange: [0, 100],
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
    bottom: 0,
    left: 0,
    height: 5,
    zIndex: 1,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default LongPressButton;
