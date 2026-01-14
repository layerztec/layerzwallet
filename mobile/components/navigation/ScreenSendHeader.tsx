import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ThemedText } from '../ThemedText';
import { getNetworkImageAsset } from '@/utils/networkAssets';
import Pressable from '../Pressable';

interface ScreenSendHeaderProps {
  title: string;
  network: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

const ScreenSendHeader: React.FC<ScreenSendHeaderProps> = ({ title, network, showBackButton = true, onBackPress, style, testID }) => {
  const router = useRouter();
  const networkImage = getNetworkImageAsset(network);

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  return (
    <View style={[styles.header, style]}>
      <View style={styles.headerContent}>
        {/* Back Button */}
        {showBackButton && (
          <Pressable style={styles.backButton} onPress={handleBackPress} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </Pressable>
        )}

        {/* Network Icon + Title */}
        <View style={styles.titleContainer}>
          {networkImage && (
            <View style={styles.networkIconContainer}>
              <Image source={networkImage} style={styles.networkIcon} contentFit="contain" />
            </View>
          )}
          <ThemedText style={styles.title} testID={testID}>
            {title}
          </ThemedText>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  networkIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  networkIcon: {
    width: 28,
    height: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.8)',
  },
});

export default ScreenSendHeader;
