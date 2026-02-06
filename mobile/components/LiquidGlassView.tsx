import React from 'react';
import { Platform, View, ViewStyle, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

// Try to import GlassView, but fallback gracefully if not available
let GlassView: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const glassEffect = require('expo-glass-effect');
  GlassView = glassEffect.GlassView;
  if (__DEV__) {
    console.log('expo-glass-effect loaded successfully, GlassView available:', !!GlassView);
  }
} catch (error) {
  // expo-glass-effect not available, will use BlurView fallback
  if (__DEV__) {
    console.log('expo-glass-effect not available, error:', error);
  }
}

interface LiquidGlassViewProps {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default' | 'systemChromeMaterial';
  glassStyle?: 'clear' | 'regular'; // expo-glass-effect only supports 'clear' | 'regular'
  borderIntensity?: number; // 0-1, controls border dimming (0 = no dimming, 1 = fully dimmed)
  style?: ViewStyle;
  children?: React.ReactNode;
}

/**
 * LiquidGlassView - Platform-specific wrapper for liquid glass effects
 * 
 * iOS 26+ (iOS 18+): Uses native GlassView from expo-glass-effect
 * iOS <26 / Android: Falls back to PlatformBlurView with enhanced styling
 */
const LiquidGlassView: React.FC<LiquidGlassViewProps> = ({
  intensity = 8,
  tint = 'light',
  glassStyle = 'clear', // Use 'clear' for lighter effect, 'regular' for default
  borderIntensity = 0.3, // Default border dimming (0 = no dimming, 1 = fully dimmed)
  style,
  children,
}) => {
  // Extract borderRadius and other properties from style
  const styleObj = style || {};
  const { borderRadius, overflow, ...restStyle } = styleObj;
  const containerStyle: ViewStyle = {
    ...(restStyle as ViewStyle),
    backgroundColor: 'transparent',
  };
  const glassViewStyle: ViewStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius,
    overflow: overflow || 'hidden',
  };

  // Android fallback: Use simple white 10% transparency background (check this FIRST)
  if (Platform.OS === 'android') {
    if (__DEV__) {
      console.log('Using Android fallback (simple white background):', { Platform: Platform.OS });
    }
    return (
      <View style={containerStyle}>
        <View 
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius,
              overflow: overflow || 'hidden',
            }
          ]} 
        />
        {children}
      </View>
    );
  }

  // Check if we're on iOS and GlassView is available
  if (Platform.OS === 'ios' && GlassView) {
    // Use native GlassView for iOS 26+ (iOS 18+)
    // This will automatically fallback to regular View on unsupported versions
    // According to the API: glassEffectStyle accepts 'clear' | 'regular'
    // tintColor is a string - for light effect, we can use light colors or leave undefined
    // Note: Native GlassView doesn't support intensity prop, so we use opacity to reduce intensity
    const glassEffectStyle = glassStyle === 'clear' ? 'clear' : 'regular';
    
    // For tintColor, try not setting it for light effect to get system default
    // Or use a very light transparent color
    // The tintColor prop accepts any string color value
    let tintColorValue: string | undefined;
    if (tint === 'light') {
      // For light effect, don't set tintColor - let it use system default
      // Or try a very light transparent white
      tintColorValue = undefined; // Let system handle it for lighter appearance
    } else if (tint === 'dark') {
      tintColorValue = '#000000'; // Black tint for dark effect
    } else {
      // Default - don't set tintColor, let it use system default
      tintColorValue = undefined;
    }
    
    // Note: Native GlassView doesn't support intensity prop directly
    // The glass effect intensity is controlled by glassEffectStyle ('clear' = lighter, 'regular' = stronger)
    // and tintColor. 
    // To simulate intensity control, we can add a semi-transparent overlay that reduces the glass visibility
    // while keeping children at full opacity by rendering them above the overlay.
    
    // Map intensity to overlay opacity (lower intensity = more overlay = less visible glass)
    // Scale: intensity 1-20 maps to overlay opacity 0.0-0.6
    const overlayOpacity = intensity <= 1 ? 0.6 : intensity >= 20 ? 0.0 : 0.6 - (intensity - 1) * (0.6 / 19);
    
    // Debug: Log which component is being used (remove in production)
    if (__DEV__) {
      console.log('Using GlassView with:', { glassEffectStyle, tintColor: tintColorValue, tint, intensity, overlayOpacity });
    }
    
    // Wrap GlassView in a container so we can add an overlay to reduce glass visibility
    // while keeping children at full opacity by rendering them above the overlay
    // Apply borderRadius to GlassView itself, not the container, to preserve the border
    return (
      <View style={containerStyle}>
        <GlassView
          glassEffectStyle={glassEffectStyle}
          tintColor={tintColorValue}
          style={glassViewStyle}
        />
        {/* Overlay to reduce glass visibility based on intensity */}
        {overlayOpacity > 0 && (
          <View 
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: tint === 'light' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)', opacity: overlayOpacity, borderRadius, overflow: 'hidden' }
            ]} 
            pointerEvents="none"
          />
        )}
        {/* Border overlay to dim the glass border effect - uses a subtle border that matches background */}
        {borderIntensity > 0 && borderRadius && (
          <View 
            style={[
              StyleSheet.absoluteFill,
              {
                borderWidth: 1,
                // Use a color that matches the background to dim the glass border
                // For light tint, use a dark border to dim; for dark tint, use a light border to dim
                borderColor: tint === 'light' 
                  ? `rgba(0, 0, 0, ${borderIntensity * 0.3})` 
                  : `rgba(255, 255, 255, ${borderIntensity * 0.3})`,
                borderRadius,
              }
            ]} 
            pointerEvents="none"
          />
        )}
        {/* Children rendered above overlay at full opacity */}
        {children}
      </View>
    );
  }
  
  // Debug: Log fallback usage (remove in production)
  if (__DEV__) {
    console.log('Using BlurView fallback:', { Platform: Platform.OS, GlassViewAvailable: !!GlassView });
  }
  
  // iOS fallback: Use BlurView with light tint
  // For a lighter appearance, we use a combination of light tint and a semi-transparent white overlay
  const blurTint = tint === 'light' ? 'light' : tint === 'dark' ? 'dark' : 'default';
  
  // Use intensity directly (removed minimum constraint to allow lower values)
  // Clamp to valid range (0-100 for BlurView)
  const adjustedIntensity = Math.max(0, Math.min(100, intensity));
  
  // Reuse borderRadius and overflow already extracted above
  const blurViewStyle: ViewStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius,
    overflow: overflow || 'hidden',
  };
  
  return (
    <View style={containerStyle}>
      <BlurView 
        intensity={adjustedIntensity} 
        tint={blurTint} 
        style={blurViewStyle} 
        experimentalBlurMethod="dimezisBlurView"
      />
      {/* Light overlay to brighten the effect */}
      {(tint === 'light' || tint === 'default') && (
        <View 
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius, overflow: 'hidden' }
          ]} 
          pointerEvents="none"
        />
      )}
      {children}
    </View>
  );
};

export default LiquidGlassView;
