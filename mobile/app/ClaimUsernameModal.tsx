import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';

import { NetworkContext } from '@shared/hooks/NetworkContext';
import { createClient } from '@shared/openapi/generated/layerzme/client';
import { getApiUsersByUsername, postApiUsers } from '@shared/openapi/generated/layerzme';
import { getGradientColors } from '@/utils/gradientUtils';
import { ThemedText } from '@/components/ThemedText';

export type ClaimUsernameModalParams = {
  sparkAddress: string;
};

const layerzClient = createClient({
  baseUrl: 'https://layerz.me',
});

export default function ClaimUsernameModalScreen() {
  const router = useRouter();
  const { sparkAddress } = useLocalSearchParams<ClaimUsernameModalParams>();
  const { network } = useContext(NetworkContext);
  const backgroundColor = getGradientColors(network)[1];

  const [username, setUsername] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const sparkAddressString = sparkAddress;

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const handleClaim = useCallback(async () => {
    const u = username.trim();
    setErrorMessage('');

    if (!u) {
      setErrorMessage('Please enter a username');
      return;
    }

    if (!sparkAddressString) {
      setErrorMessage('Missing spark address');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: existing } = await getApiUsersByUsername({
        client: layerzClient,
        path: { username: u },
        responseStyle: 'fields',
        throwOnError: false,
      });

      if (existing?.username) {
        setErrorMessage('Username is unavailable');
        return;
      }

      const { data: claim } = await postApiUsers({
        client: layerzClient,
        body: { username: u, sparkAddress: sparkAddressString },
        responseStyle: 'fields',
        throwOnError: true,
      });

      if (claim?.username) {
        router.back();
        return;
      }

      setErrorMessage('Unable to claim username');
    } catch (e) {
      setErrorMessage('Unable to claim username');
    } finally {
      setIsSubmitting(false);
    }
  }, [router, sparkAddressString, username]);

  return (
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
                  editable={!isSubmitting}
                />
                <View style={styles.suffixContainer}>
                  <ThemedText style={styles.suffixText}>@layerz.me</ThemedText>
                </View>
              </View>

              {Boolean(errorMessage) && <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>}

              <TouchableOpacity style={styles.claimButton} onPress={handleClaim} activeOpacity={0.8} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator color="#f7f5ff" /> : <ThemedText style={styles.claimButtonText}>Claim</ThemedText>}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </TouchableOpacity>
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
