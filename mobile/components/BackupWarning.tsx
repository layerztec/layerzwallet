import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import SectionContainer from '@/components/SectionContainer';
import Pressable from '@/components/Pressable';

interface BackupWarningProps {
  onPress: () => void;
}

const BackupWarning: React.FC<BackupWarningProps> = ({ onPress }) => {
  return (
    <Pressable onPress={onPress} activeOpacity={0.8}>
      <SectionContainer contentStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.icon}>
            <Ionicons name="alert-circle-outline" size={24} color="rgba(255, 255, 255, 0.9)" />
          </View>
          <ThemedText style={styles.title}>Recovery phrase</ThemedText>
        </View>
        <View style={styles.textRow}>
          <ThemedText style={styles.text}>Your Recovery phrase is necessary to recover your wallet. Please verify you have backed it up.</ThemedText>
        </View>
      </SectionContainer>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingTop: 12,
    paddingRight: 16,
    paddingBottom: 12,
    paddingLeft: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    color: 'white',
    fontWeight: '600',
    flex: 1,
  },
  textRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingLeft: 10,
  },
  text: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '400',
    flex: 1,
  },
});

export default BackupWarning;
