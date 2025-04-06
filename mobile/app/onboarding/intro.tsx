import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function IntroScreen() {
  const router = useRouter();

  const handleCreateWallet = async () => {
    router.replace('/onboarding/create-wallet');
  };

  const handleImportWallet = () => {
    router.replace('/onboarding/import-wallet');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>TEST SHOULD FAIL</Text>
        <Text style={styles.subtitle}>Do you want to create a new wallet or import an existing one?</Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleCreateWallet}>
          <Text style={styles.buttonText}>Create New Wallet</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={handleImportWallet}>
          <Text style={styles.buttonText}>Import Existing</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  buttonContainer: {
    marginBottom: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
