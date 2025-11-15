import React, { useContext } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { usePreventScreenCapture } from 'expo-screen-capture';

import { ThemedText } from '@/components/ThemedText';
import { NetworkContext } from '@shared/hooks/NetworkContext';

export default function SeedBackupQRScreen() {
  const router = useRouter();
  const { mnemonic } = useLocalSearchParams<{ mnemonic: string }>();
  const { network } = useContext(NetworkContext);
  usePreventScreenCapture();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Recovery Phrase</ThemedText>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.qrCodeSection}>
        <View style={styles.qrCodeWrapper}>{mnemonic && <QRCode value={mnemonic} size={280} color="#000033" backgroundColor="white" />}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgb(90, 98, 135)',
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    padding: 4,
    position: 'absolute',
    right: 20,
    zIndex: 10,
  },
  qrCodeSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  qrCodeWrapper: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
