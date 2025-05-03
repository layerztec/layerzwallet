import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { ThemedText } from '../ThemedText';
import { useTheme } from '@/hooks/ThemeContext';

type LogotypeProps = {
  size?: 'small' | 'medium' | 'large';
  variant?: 'horizontal' | 'stacked' | 'icon';
  includeTagline?: boolean;
};

/**
 * Layerz Wallet Logotype component
 * Consistently displays the logo across the app with various size options
 */
export function Logotype({ size = 'medium', variant = 'horizontal', includeTagline = false }: LogotypeProps) {
  const { getColor } = useTheme();

  // Set dimensions based on size
  let logoHeight;
  let fontSize;
  let taglineSize;

  switch (size) {
    case 'small':
      logoHeight = 24;
      fontSize = 18;
      taglineSize = 10;
      break;
    case 'large':
      logoHeight = 48;
      fontSize = 32;
      taglineSize = 14;
      break;
    default: // medium
      logoHeight = 32;
      fontSize = 24;
      taglineSize = 12;
  }

  // For the icon-only variant
  if (variant === 'icon') {
    return (
      <View style={styles.iconContainer}>
        <Image source={require('../../assets/images/logo-icon.png')} style={{ width: logoHeight, height: logoHeight }} resizeMode="contain" />
      </View>
    );
  }

  // For horizontal layout
  if (variant === 'horizontal') {
    return (
      <View>
        <View style={styles.horizontalContainer}>
          <Image source={require('../../assets/images/logo-icon.png')} style={{ width: logoHeight, height: logoHeight }} resizeMode="contain" />
          <View style={styles.textContainer}>
            <ThemedText style={[styles.logoText, { fontSize }]} variant="headingLarge">
              Layerz
            </ThemedText>

            {includeTagline && (
              <ThemedText style={[styles.tagline, { fontSize: taglineSize }]} variant="caption" color={getColor('textSecondary')}>
                Explore Bitcoin Layer 2
              </ThemedText>
            )}
          </View>
        </View>
      </View>
    );
  }

  // For stacked layout
  return (
    <View style={styles.stackedContainer}>
      <Image source={require('../../assets/images/logo-icon.png')} style={[styles.stackedLogo, { height: logoHeight * 1.5 }]} resizeMode="contain" />
      <ThemedText style={[styles.logoText, { fontSize }]} variant="headingLarge">
        Layerz
      </ThemedText>

      {includeTagline && (
        <ThemedText style={[styles.tagline, { fontSize: taglineSize }]} variant="caption" color={getColor('textSecondary')}>
          Explore Bitcoin Layer 2
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  horizontalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackedLogo: {
    width: '100%',
    marginBottom: 8,
  },
  textContainer: {
    marginLeft: 8,
  },
  logoText: {
    fontWeight: '700',
  },
  tagline: {
    marginTop: 2,
  },
});
