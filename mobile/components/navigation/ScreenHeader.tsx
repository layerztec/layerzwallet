import React from 'react';
import { View, StyleSheet, ViewStyle, TextStyle, StatusBar } from 'react-native';
import { ThemedText } from '../ThemedText';
import BackButton from './BackButton';

interface ScreenHeaderProps {
  title?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  rightComponent?: React.ReactNode;
  style?: ViewStyle;
}

const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, showBackButton = true, onBackPress, rightComponent, style }) => {
  return (
    <View style={[styles.header, style]}>
      <View style={styles.headerContent}>
        <View style={styles.leftContainer}>{showBackButton && <BackButton onPress={onBackPress} />}</View>

        <View style={styles.centerContainer}>{title && <ThemedText style={styles.title}>{title}</ThemedText>}</View>

        <View style={styles.rightContainer}>{rightComponent}</View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  centerContainer: {
    flex: 2,
    alignItems: 'center',
  },
  rightContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  title: {
    textAlign: 'center',
  },
});

export default ScreenHeader;
