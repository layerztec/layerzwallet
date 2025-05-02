import React, { useState, useRef, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, View, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '@/hooks/ThemeContext';

interface LongPressButtonProps {
  onLongPressComplete: () => void;
  title: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
  progressColor?: string;
  backgroundColor?: string;
  disabled?: boolean;
  duration?: number;
  isLoading?: boolean;
}

const LongPressButton: React.FC<LongPressButtonProps> = ({ onLongPressComplete, title, style, textStyle, progressColor, backgroundColor, disabled = false, duration = 1500, isLoading = false }) => {
  const { getColor } = useTheme();
  const [pressing, setPressing] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  // Reset progress when pressing state changes to false
  useEffect(() => {
    if (!pressing) {
      progressAnim.setValue(0);
    }
  }, [pressing, progressAnim]);

  const startProgress = () => {
    setPressing(true);
    Animated.timing(progressAnim, {
      toValue: 100,
      duration: duration,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && pressing) {
        onLongPressComplete();
        resetProgress();
      }
    });
  };

  const resetProgress = () => {
    setPressing(false);
  };

  // Use theme colors if custom colors are not provided
  const bgColor = backgroundColor || getColor('primary');
  const prgColor = progressColor || getColor('primaryLight');

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={[styles.button, { backgroundColor: bgColor }, disabled ? styles.disabled : null, style]}
      onPressIn={disabled || isLoading ? undefined : startProgress}
      onPressOut={resetProgress}
      disabled={disabled || isLoading}
    >
      <View style={styles.contentContainer}>
        {isLoading ? <ActivityIndicator color={getColor('white')} /> : <Text style={[styles.buttonText, { color: getColor('white') }, textStyle]}>{title}</Text>}
      </View>

      {pressing && (
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: progressWidth,
              backgroundColor: prgColor,
            },
          ]}
        />
      )}
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
    fontWeight: '600',
    fontSize: 16,
  },
  progressBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 1,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default LongPressButton;
