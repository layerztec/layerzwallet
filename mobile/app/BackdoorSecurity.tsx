import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSecurityContext } from '@/hooks/useSecurityContext';
import { isMaestroEnvironment } from '@/utils/maestro';

const TEST_PIN = '1234';

const BackdoorSecurity: React.FC = () => {
  const router = useRouter();
  const { isSecurityEnabled, backdoorEnableSecurity, disableSecurity, isAppLocked, backdoorUnlockApp } = useSecurityContext();
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (!isMaestroEnvironment()) {
      router.back();
      return;
    }
  }, [router]);

  const handleAction = async (action: 'enable' | 'disable' | 'unlock') => {
    if (pin !== TEST_PIN) return;

    try {
      switch (action) {
        case 'enable':
          await backdoorEnableSecurity();
          break;
        case 'disable':
          await disableSecurity();
          break;
        case 'unlock':
          await backdoorUnlockApp();
          break;
      }
      setPin('');
      router.back();
    } catch (error) {
      console.error('Error during backdoor security action:', error);
    }
  };

  // Safety check - don't render backdoor if not in Maestro environment
  if (!isMaestroEnvironment()) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 20, backgroundColor: '#fff' }}>
        <Text>Backdoor not available</Text>
        <TouchableOpacity style={{ padding: 15, backgroundColor: '#8E8E93' }} onPress={() => router.back()}>
          <Text style={{ color: 'white', textAlign: 'center' }}>Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 20, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 18, marginBottom: 20 }}>Security Test</Text>

      <Text style={{ marginBottom: 10 }}>Status: {isSecurityEnabled ? 'ON' : 'OFF'}</Text>
      <Text style={{ marginBottom: 20 }}>Locked: {isAppLocked ? 'YES' : 'NO'}</Text>

      <TextInput
        style={{ borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 20 }}
        placeholder="PIN"
        value={pin}
        onChangeText={setPin}
        secureTextEntry
        testID="backdoor-security-pin"
        keyboardType="numeric"
        maxLength={4}
      />

      <TouchableOpacity style={{ padding: 15, backgroundColor: '#007AFF', marginBottom: 10 }} onPress={() => handleAction('enable')} testID="backdoor-security-enable">
        <Text style={{ color: 'white', textAlign: 'center' }}>Enable</Text>
      </TouchableOpacity>

      <TouchableOpacity style={{ padding: 15, backgroundColor: '#FF3B30', marginBottom: 10 }} onPress={() => handleAction('disable')} testID="backdoor-security-disable">
        <Text style={{ color: 'white', textAlign: 'center' }}>Disable</Text>
      </TouchableOpacity>

      <TouchableOpacity style={{ padding: 15, backgroundColor: '#FF9500', marginBottom: 10 }} onPress={() => handleAction('unlock')} testID="backdoor-security-unlock">
        <Text style={{ color: 'white', textAlign: 'center' }}>Unlock</Text>
      </TouchableOpacity>

      <TouchableOpacity style={{ padding: 15, backgroundColor: '#8E8E93' }} onPress={() => router.back()} testID="backdoor-security-back">
        <Text style={{ color: 'white', textAlign: 'center' }}>Back</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default BackdoorSecurity;
