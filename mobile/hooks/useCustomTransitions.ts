import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

export const useHorizontalSpringTransition = (triggerAnimation: boolean = true, direction: 'forward' | 'back' = 'forward') => {
  const translateX = useRef(new Animated.Value(direction === 'forward' ? 300 : -300)).current; // Start position based on direction
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    if (triggerAnimation) {
      // Create a spring animation for horizontal slide
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(opacity, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [triggerAnimation, translateX, opacity, scale]);

  const animatedStyle = {
    transform: [{ translateX }, { scale }],
    opacity,
  };

  return animatedStyle;
};

export const useHorizontalSlideOut = (direction: 'left' | 'right' = 'left') => {
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const slideOut = (callback?: () => void) => {
    const toValue = direction === 'left' ? -300 : 300;
    Animated.parallel([
      Animated.spring(translateX, {
        toValue,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(opacity, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 0.95,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start(callback);
  };

  const animatedStyle = {
    transform: [{ translateX }, { scale }],
    opacity,
  };

  return { animatedStyle, slideOut };
};

export const useSequentialSpringAnimation = (delay: number = 0) => {
  const translateX = useRef(new Animated.Value(50)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          tension: 120,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.spring(opacity, {
          toValue: 1,
          tension: 120,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, translateX, opacity]);

  return {
    transform: [{ translateX }],
    opacity,
  };
};
