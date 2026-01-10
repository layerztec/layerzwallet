import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View, ActivityIndicator } from 'react-native';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { createClient } from '@shared/openapi/generated/layerzme/client';
import { getApiUsersByUsername, postApiUsers } from '@shared/openapi/generated/layerzme';
import { getGradientColors } from '@/utils/gradientUtils';
import { ThemedText } from '@/components/ThemedText';
import Pressable from '@/components/Pressable';

export type ClaimUsernameModalParams = {
  sparkAddress: string;
};

const layerzClient = createClient({
  baseUrl: 'https://layerz.me',
});

export default function ClaimUsernameModalScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { sparkAddress } = useLocalSearchParams<ClaimUsernameModalParams>();
  const { network } = useContext(NetworkContext);
  const backgroundColor = getGradientColors(network)[1];

  const [username, setUsername] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const sparkAddressString = sparkAddress;

  useEffect(() => {
    navigation.setOptions({
      contentStyle: {
        backgroundColor,
      },
    });
  }, [navigation, backgroundColor]);

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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.keyboardAvoidingView, { backgroundColor }]} keyboardVerticalOffset={0}>
      <Pressable accessible={false} style={[styles.modalContent, { marginBottom: keyboardHeight, backgroundColor }]} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
        <View accessible={false} style={[styles.popupContainer, { backgroundColor }]}>
          <View style={styles.contentContainer}>
            <View style={styles.formBody}>
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
            </View>

            <Pressable style={styles.claimButton} onPress={handleClaim} activeOpacity={0.8} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color="#f7f5ff" /> : <ThemedText style={styles.claimButtonText}>Claim</ThemedText>}
            </Pressable>
          </View>
        </View>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
  },
  popupContainer: {
    backgroundColor: 'rgba(54, 35, 85, 0.98)',
  },
  contentContainer: {
    padding: 20,
    gap: 24,
    flexGrow: 1,
    justifyContent: 'space-between',
    minHeight: 280,
  },
  formBody: {
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
