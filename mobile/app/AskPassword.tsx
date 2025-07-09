import React, { useState } from 'react';
import { TextInput, View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useThemeColor } from '../hooks/useThemeColor';
import { useAskPassword } from '../src/hooks/AskPasswordContext';

export default function AskPasswordScreen() {
  const [password, setPassword] = useState<string>('');
  const router = useRouter();
  const { handlePasswordSubmit } = useAskPassword();

  const backgroundColor = useThemeColor({ light: '#fff', dark: '#000' }, 'background');
  const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
  const tintColor = useThemeColor({ light: '#2f95dc', dark: '#fff' }, 'tint');

  const handlePasswordChange = (text: string) => {
    setPassword(text);
  };

  const onOkPress = () => {
    // Call the context function to submit the password
    handlePasswordSubmit(password);
    router.back();
  };

  const onCancelPress = () => {
    // Call the context function with empty password to indicate cancellation
    handlePasswordSubmit('');
    router.back();
  };

  return (
    <View style={[styles.centeredView, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
      <View style={[styles.modalView, { backgroundColor }]}>
        <Text style={[styles.modalTitle, { color: textColor }]}>Unlock your wallet</Text>
        <TextInput
          style={[styles.input, { color: textColor, borderColor: tintColor }]}
          secureTextEntry
          placeholder="Enter your password"
          placeholderTextColor="#888"
          value={password}
          onChangeText={handlePasswordChange}
          autoFocus
        />
        <View style={styles.buttonContainer}>
          <Pressable style={[styles.button, styles.buttonCancel]} onPress={onCancelPress}>
            <Text style={styles.buttonText}>Cancel</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.buttonConfirm, { backgroundColor: tintColor }]} onPress={onOkPress}>
            <Text style={styles.buttonText}>OK</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    width: '80%',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    marginBottom: 15,
    fontSize: 18,
    fontWeight: '700',
  },
  input: {
    width: '100%',
    padding: 10,
    borderWidth: 1,
    borderRadius: 5,
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  button: {
    borderRadius: 5,
    padding: 10,
    elevation: 2,
    minWidth: '40%',
    alignItems: 'center',
  },
  buttonConfirm: {
    backgroundColor: '#2196F3',
  },
  buttonCancel: {
    backgroundColor: '#888',
  },
  buttonText: {
    color: 'white',
    fontWeight: '700',
  },
});
