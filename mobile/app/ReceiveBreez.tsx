import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { NetworkContext } from '@shared/hooks/NetworkContext';

const ReceiveBreez = () => {
  const router = useRouter();
  const { network } = useContext(NetworkContext);

  const handleLightningPress = () => {
    router.push('/ReceiveLightning');
  };

  const handleLiquidPress = () => {
    router.push('/ReceiveLiquid');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Receive', headerShown: true }} />

      <ThemedView style={styles.contentContainer}>
        <ThemedView style={[styles.networkBar, { backgroundColor: '#FF9500' }]}>
          <ThemedText style={styles.networkText}>{network?.toUpperCase()}</ThemedText>
        </ThemedView>

        <ThemedText style={styles.subtitle}>Choose receive method</ThemedText>

        <TouchableOpacity style={styles.optionButton} onPress={handleLightningPress} testID="LightningButton">
          <Ionicons name="flash" size={24} color="white" />
          <ThemedText style={styles.optionButtonText}>Lightning</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.optionButton, { backgroundColor: '#3498db' }]} onPress={handleLiquidPress} testID="LiquidButton">
          <Ionicons name="water" size={24} color="white" />
          <ThemedText style={styles.optionButtonText}>Liquid</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </SafeAreaView>
  );
};

export default ReceiveBreez;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  networkBar: {
    marginBottom: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  networkText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 30,
    textAlign: 'center',
  },
  optionButton: {
    flexDirection: 'row',
    backgroundColor: '#FF9500',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    width: '80%',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  optionButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});
