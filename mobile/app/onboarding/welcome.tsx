import React from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Colors, gradients } from '@/src/shared-link/constants/Colors';
import { Typography } from '@/src/shared-link/constants/Typography';

const WelcomeScreen = () => {
  const router = useRouter();

  const handleContinue = () => {
    router.replace('/onboarding/intro');
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Image source={require('@/assets/images/pixelated-gradient.png')} style={styles.pixelatedBackground} resizeMode="cover" />

        <View style={styles.spacer} />

        <View style={styles.column}>
          <Text style={styles.welcomeText}>{'Welcome to Layerz'}</Text>

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
        <View style={styles.buttonSpacer} />
        <View style={styles.buttonContainer}>
          <TouchableOpacity onPress={handleContinue}>
            <LinearGradient start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} colors={gradients.gradient1 as [string, string]} style={styles.button}>
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
};

export default WelcomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  pixelatedBackground: {
    width: '100%',
    height: '40%',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  spacer: {
    flex: 1,
  },
  column: {
    paddingHorizontal: 40,
  },
  welcomeText: {
    color: Colors.dark.text,
    fontFamily: Typography.headline.fontFamily,
    fontSize: 42,
    fontWeight: '300' as const,
    lineHeight: Typography.headline.lineHeight,
    letterSpacing: Typography.headline.letterSpacing,
    width: 222,
    marginBottom: 20,
  },
  descriptionText: {
    color: Colors.dark.text,
    fontFamily: Typography.paragraph.fontFamily,
    fontSize: Typography.paragraph.fontSize,
    fontWeight: '400' as const,
    lineHeight: Typography.paragraph.lineHeight,
    letterSpacing: Typography.paragraph.letterSpacing,
    marginBottom: 37,
  },
  pageIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.text,
    marginRight: 10,
  },
  inactiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.tabIconDefault,
    marginRight: 10,
  },
  buttonSpacer: {
    height: 100,
  },
  buttonContainer: {
    paddingBottom: 60,
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
    color: Colors.dark.background,
    fontFamily: Typography.paragraph.fontFamily,
    fontSize: Typography.paragraph.fontSize,
    fontWeight: '400' as const,
    lineHeight: Typography.paragraph.lineHeight,
    letterSpacing: Typography.paragraph.letterSpacing,
  },
});
