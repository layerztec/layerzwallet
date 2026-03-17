import React from 'react';
import { StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import Pressable, { PressableProps } from './Pressable';
import PlatformBlurView from './PlatformBlurView';
import { ThemedText } from './ThemedText';

export interface ButtonProps extends PressableProps {
  title: string;
  variant?: 'high' | 'normal' | 'light' | 'lighter' | 'secondary' | 'dark' | 'darker';
  loading?: boolean;
  textStyle?: TextStyle;
}

export default function Button({ title, onPress, variant = 'normal', disabled = false, loading = false, style, textStyle, activeOpacity = 0.8, ...restProps }: ButtonProps) {
  const getButtonStyle = (): ViewStyle[] => {
    let baseStyle: ViewStyle[] = [styles.button];

    if (disabled) {
      baseStyle.push(styles.disabled);
    }

    if (style) {
      baseStyle = StyleSheet.compose(baseStyle, style) as ViewStyle[];
    }

    return baseStyle;
  };

  const getBlurViewStyle = (): ViewStyle => {
    switch (variant) {
      case 'high':
        return styles.blurHigh;
      case 'normal':
        return styles.blurNormal;
      case 'light':
        return styles.blurLight;
      case 'lighter':
        return styles.blurLighter;
      case 'secondary':
        return styles.blurSecondary;
      case 'dark':
        return styles.blurDark;
      case 'darker':
        return styles.blurDarker;
      default:
        return styles.blurNormal;
    }
  };

  const getTextStyle = (): TextStyle[] => {
    const baseTextStyle: TextStyle[] = [styles.buttonText];

    if (variant === 'secondary' || variant === 'dark' || variant === 'darker') {
      baseTextStyle.push(styles.secondaryText);
    }

    if (textStyle) {
      baseTextStyle.push(textStyle);
    }

    return baseTextStyle;
  };

  const renderContent = () => {
    if (loading) {
      return <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.8)" />;
    }

    return (
      <ThemedText type="button" style={getTextStyle()}>
        {title}
      </ThemedText>
    );
  };

  if (variant === 'secondary') {
    return (
      <Pressable style={[styles.button, styles.secondaryButton, style]} onPress={onPress} disabled={disabled || loading} activeOpacity={activeOpacity} {...restProps}>
        {renderContent()}
      </Pressable>
    );
  }

  const blurStyle = {
    ...styles.blurContainer,
    ...getBlurViewStyle(),
  };

  return (
    <Pressable style={getButtonStyle()} onPress={onPress} disabled={disabled || loading} activeOpacity={activeOpacity} {...restProps}>
      <PlatformBlurView intensity={25} tint="dark" style={blurStyle}>
        {renderContent()}
      </PlatformBlurView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
  },
  blurContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  blurHigh: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  blurNormal: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  blurLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  blurLighter: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  blurDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  blurDarker: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  blurSecondary: {
    backgroundColor: 'transparent',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: -0.32,
    textAlign: 'center',
    lineHeight: 20,
    includeFontPadding: false,
  },
  secondaryText: {
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  disabled: {
    opacity: 0.3,
  },
});
