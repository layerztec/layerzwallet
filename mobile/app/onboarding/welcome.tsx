import React from 'react';
import { SafeAreaView, View, ScrollView, Text, TouchableOpacity, StyleSheet, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { welcomeColors, gradients } from '@/src/shared-link/constants/Colors';
import { Typography } from '@/src/shared-link/constants/Typography';

export default function WelcomeScreen() {
  const router = useRouter();

  const handleContinue = () => {
    router.replace('/onboarding/intro');
  };

  return (
    <View style={styles.container}>
      {/* Pixelated hero background covers status bar and hero section */}
      <ImageBackground source={require('@/assets/images/pixelated-gradient.png')} style={styles.pixelatedBackground} resizeMode="cover">
        {/* Bottom fade gradient overlay */}
        <LinearGradient start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} colors={gradients.welcomeBottomOverlay as [string, string]} style={styles.bottomFade} />
      </ImageBackground>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.column}>
            {/* Hero section text overlay */}
            <View style={styles.heroSection}>
              <Text style={styles.welcomeText}>{'Welcome to Layerz'}</Text>
            </View>

            <Text style={styles.descriptionText}>
              {"Layerz starts with your Base Wallet — this is your core Bitcoin account. It's where your Bitcoin is stored, secured by your keys. Every other layer connects to this foundation."}
            </Text>
            <View style={styles.pageIndicators}>
              <View style={styles.activeDot} />
              <View style={styles.inactiveDot} />
              <View style={styles.inactiveDot} />
              <View style={styles.inactiveDot} />
              <View style={styles.inactiveDot} />
              <View style={styles.inactiveDot} />
            </View>
          </View>
        </ScrollView>

        {/* Pinned Get Started button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity onPress={handleContinue}>
            <LinearGradient start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} colors={gradients.welcomeButton as [string, string]} style={styles.button}>
              <View style={styles.buttonContent}>
                <View style={styles.arrowIcon}>
                  <Text style={styles.arrowText}>→</Text>
                </View>
                <Text style={styles.buttonText}>{'Get Started'}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: welcomeColors.background,
  },
  pixelatedBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    zIndex: -1,
  },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 192,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingBottom: 20, // Minimal space for the fixed button
  },
  column: {
    marginBottom: 5, // Very small bottom margin
  },
  heroSection: {
    height: 300, // Reduce hero section height (was 400)
    width: '100%',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  welcomeText: {
    color: welcomeColors.textPrimary,
    fontFamily: Typography.headline.fontFamily,
    fontSize: 42,
    fontWeight: '300' as const,
    lineHeight: Typography.headline.lineHeight,
    letterSpacing: Typography.headline.letterSpacing,
    width: 222,
    marginBottom: 20, // Reduce bottom margin (was 40)
    marginLeft: 40, // Add left margin here instead of padding on hero section
  },
  descriptionText: {
    color: welcomeColors.textPrimary,
    fontFamily: Typography.paragraph.fontFamily,
    fontSize: Typography.paragraph.fontSize,
    fontWeight: '400' as const,
    lineHeight: Typography.paragraph.lineHeight,
    letterSpacing: Typography.paragraph.letterSpacing,
    marginBottom: 8, // Much smaller bottom margin (was 15)
    marginLeft: 40,
    width: 303,
  },
  pageIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5, // Very small bottom margin (was 20)
    marginLeft: 40,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: welcomeColors.textPrimary,
    marginRight: 10,
  },
  inactiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: welcomeColors.textSecondary,
    marginRight: 10,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 60, // Move button higher from bottom
    left: 0,
    right: 0,
    paddingBottom: 0, // Remove extra padding since we moved it up
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  button: {
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 17,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 2,
  },
  arrowIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  arrowText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
  },
  buttonText: {
    color: welcomeColors.buttonText,
    fontFamily: Typography.paragraph.fontFamily,
    fontSize: Typography.paragraph.fontSize,
    fontWeight: '400' as const,
    lineHeight: Typography.paragraph.lineHeight,
    letterSpacing: Typography.paragraph.letterSpacing,
  },
});
