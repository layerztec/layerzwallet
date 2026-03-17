import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import Pressable from '@/components/Pressable';
import { ThemedText } from '@/components/ThemedText';
import { overlayBackground, overlayBackgroundSections } from '@shared/constants/Colors';

interface SectionContainerProps {
  title?: string;
  onViewAll?: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

const BORDER_RADIUS = 12;

const SectionContainer: React.FC<SectionContainerProps> = ({ title, onViewAll, children, style, contentStyle }) => {
  return (
    <View style={[styles.wrapper, style]}>
      {(title || onViewAll) && (
        <View style={styles.header}>
          {title && <ThemedText style={styles.title}>{title}</ThemedText>}
          {onViewAll && (
            <Pressable style={styles.viewAllButton} onPress={onViewAll} activeOpacity={0.7}>
              <ThemedText style={styles.viewAllText}>View all</ThemedText>
            </Pressable>
          )}
        </View>
      )}
      <View style={[styles.container, contentStyle]}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '500',
    color: 'white',
  },
  viewAllButton: {
    backgroundColor: overlayBackground,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  container: {
    backgroundColor: overlayBackgroundSections,
    borderRadius: BORDER_RADIUS,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    paddingVertical: 8,
  },
});

export default SectionContainer;
