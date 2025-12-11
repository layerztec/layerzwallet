import React, { useContext, useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getGradientColors } from '@/utils/gradientUtils';
import { ThemedText } from '@/components/ThemedText';

interface ClaimUsernameModalProps {
  visible: boolean;
  onClose: () => void;
  onClaim?: (username: string) => void;
  errorMessage?: string;
}

export function ClaimUsernameModal({ visible, onClose, onClaim, errorMessage }: ClaimUsernameModalProps) {
  const { network } = useContext(NetworkContext);
  const backgroundColor = getGradientColors(network)[1];
  const [username, setUsername] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const handleClaim = () => {
    if (onClaim) {
      onClaim(username);
    }
  };

  const handleClose = () => {
    setUsername('');
    onClose();
  };

  useEffect(() => {
    if (!visible) return;

    const keyboardWillShowListener = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const keyboardWillHideListener = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <TouchableOpacity accessible={false} style={styles.modalOverlay} activeOpacity={1} onPress={handleClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoidingView} keyboardVerticalOffset={0}>
          <TouchableOpacity accessible={false} style={[styles.modalContent, { marginBottom: keyboardHeight > 0 ? keyboardHeight : 50 }]} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View accessible={false} style={[styles.popupContainer, { backgroundColor }]}>
              <View style={styles.contentContainer}>
                <ThemedText style={styles.title}>Claim username</ThemedText>

                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Your username"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <View style={styles.suffixContainer}>
                    <ThemedText style={styles.suffixText}>@layerz.me</ThemedText>
                  </View>
                </View>

                {Boolean(errorMessage) && <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>}

                <TouchableOpacity style={styles.claimButton} onPress={handleClaim} activeOpacity={0.8}>
                  <ThemedText style={styles.claimButtonText}>Claim</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  keyboardAvoidingView: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 16,
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
  },
  popupContainer: {
    backgroundColor: 'rgba(54, 35, 85, 0.98)',
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
    width: '100%',
  },
  contentContainer: {
    padding: 20,
    gap: 14,
  },
  title: {
    color: '#f2ecff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    backgroundColor: '#3f3559',
    borderRadius: 14,
    overflow: 'visible',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: 'white',
    fontSize: 15,
  },
  suffixContainer: {
    backgroundColor: '#675a8f',
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: 'center',
    alignSelf: 'center',
    borderRadius: 10,
    marginRight: 8,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  suffixText: {
    color: '#f2ecff',
    fontSize: 15,
    fontWeight: '500',
  },
  claimButton: {
    backgroundColor: '#9b8bd0',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimButtonText: {
    color: '#f7f5ff',
    fontSize: 15,
    fontWeight: '600',
  },
  errorText: {
    color: '#f28b82',
    fontSize: 13,
    marginTop: 4,
  },
});
