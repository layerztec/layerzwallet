import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useContext, useState } from 'react';
import { View, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert, Text, Clipboard } from 'react-native';

import GradientScreen from '@/components/GradientScreen';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import { ThemedText } from '@/components/ThemedText';
import { AskPasswordContext } from '@/src/hooks/AskPasswordContext';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getIsEVM } from '@shared/models/network-getters';
import { NETWORK_SPARK } from '@shared/types/networks';

const SignMessage = () => {
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { askPassword } = useContext(AskPasswordContext);

  const [message, setMessage] = useState('');
  const [signature, setSignature] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [address, setAddress] = useState<string>('');

  // This screen is available for all EVM-compatible networks and Spark
  // But we'll handle it gracefully if accessed from unsupported networks
  const isEVMNetwork = network ? getIsEVM(network) : false;
  const isSparkNetwork = network === NETWORK_SPARK;
  const isSupported = isEVMNetwork || isSparkNetwork;

  // Fetch the address when component mounts or network/account changes
  React.useEffect(() => {
    const fetchAddress = async () => {
      if (isSupported && network) {
        try {
          const walletAddress = await BackgroundExecutor.getAddress(network, accountNumber);
          setAddress(walletAddress);
        } catch (error) {
          console.error('Failed to fetch address:', error);
        }
      }
    };
    fetchAddress();
  }, [network, accountNumber, isSupported]);

  const handleSign = async () => {
    if (!message.trim()) {
      Alert.alert('Error', 'Please enter a message to sign');
      return;
    }

    if (!isSupported) {
      Alert.alert('Error', 'Message signing is only available on EVM-compatible networks and Spark');
      return;
    }

    setIsLoading(true);
    try {
      let result;
      if (isSparkNetwork) {
        // Spark doesn't need password as it uses unencrypted submnemonics
        result = await BackgroundExecutor.signSparkMessage(
          message,
          accountNumber,
          null // No password needed for Spark
        );
      } else {
        // EVM chains need password to decrypt the mnemonic
        const password = await askPassword();
        result = await BackgroundExecutor.signPersonalMessage(
          message,
          accountNumber,
          password
        );
      }

      if (result?.success) {
        setSignature(result.bytes || result.signature);
        Alert.alert('Success', 'Message signed successfully!');
      } else {
        throw new Error(result.message || 'Failed to sign message');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sign message');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (signature) {
      Clipboard.setString(signature);
      Alert.alert('Copied', 'Signature copied to clipboard');
    }
  };

  return (
    <GradientScreen variant={network}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Sign Message" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentContainer}>
          {isSupported ? (
            <>
              <ThemedText style={styles.description}>
                Sign a message with your {isSparkNetwork ? 'Spark identity' : 'EVM private'} key. This creates a cryptographic proof
                that you control this wallet address on the {network} network.
              </ThemedText>

              <View style={styles.inputSection}>
                <ThemedText style={styles.inputLabel}>Signing Address</ThemedText>
                <View style={styles.addressContainer}>
                  <Text style={styles.addressText}>{address || 'Loading...'}</Text>
                  {address && (
                    <TouchableOpacity
                      onPress={() => {
                        Clipboard.setString(address);
                        Alert.alert('Copied', 'Address copied to clipboard');
                      }}
                      style={styles.copyIcon}
                    >
                      <Ionicons name="copy-outline" size={16} color="rgba(255, 255, 255, 0.6)" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.inputSection}>
                <ThemedText style={styles.inputLabel}>Message to Sign</ThemedText>
                <TextInput
                  style={styles.messageInput}
                  placeholder="Enter your message here..."
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              <TouchableOpacity
                style={[styles.signButton, isLoading && styles.buttonDisabled]}
                onPress={handleSign}
                disabled={isLoading}
              >
                <Ionicons name="key-outline" size={20} color="rgba(255, 255, 255, 0.9)" />
                <ThemedText style={styles.signButtonText}>
                  {isLoading ? 'Signing...' : 'Sign Message'}
                </ThemedText>
              </TouchableOpacity>

              {signature ? (
                <View style={styles.resultSection}>
                  <ThemedText style={styles.resultLabel}>{isSparkNetwork ? 'Spark' : 'EVM'} Signature:</ThemedText>
                  <View style={styles.signatureContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <Text style={styles.signatureText}>{signature}</Text>
                    </ScrollView>
                  </View>
                  <TouchableOpacity style={styles.copyButton} onPress={copyToClipboard}>
                    <Ionicons name="copy-outline" size={18} color="rgba(255, 255, 255, 0.8)" />
                    <ThemedText style={styles.copyButtonText}>Copy Signature</ThemedText>
                  </TouchableOpacity>
                </View>
              ) : null}

              <View style={styles.infoSection}>
                <Ionicons name="information-circle-outline" size={20} color="rgba(255, 255, 255, 0.6)" />
                <ThemedText style={styles.infoText}>
                  This signature proves you control the private key for account #{accountNumber} on the {network} network without revealing the key itself.
                </ThemedText>
              </View>
            </>
          ) : (
            <View style={styles.unsupportedSection}>
              <Ionicons name="alert-circle-outline" size={48} color="rgba(255, 255, 255, 0.4)" />
              <ThemedText style={styles.unsupportedText}>
                Message signing is only available on EVM-compatible networks and Spark.
              </ThemedText>
              <ThemedText style={styles.unsupportedSubtext}>
                Please switch to a supported network (Rootstock, Botanix, Spark, etc.) from the home screen to use this feature.
              </ThemedText>
            </View>
          )}
        </View>
      </ScrollView>
    </GradientScreen>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  contentContainer: {
    flex: 1,
    paddingVertical: 20,
  },
  description: {
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 30,
    lineHeight: 20,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 10,
    fontWeight: '500',
  },
  addressContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addressText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontFamily: 'monospace',
    flex: 1,
  },
  copyIcon: {
    marginLeft: 10,
    padding: 4,
  },
  messageInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    minHeight: 120,
    fontSize: 14,
  },
  signButton: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 30,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  signButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  resultSection: {
    backgroundColor: 'rgba(0, 255, 0, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 0, 0.2)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 30,
  },
  resultLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 10,
    fontSize: 12,
  },
  signatureContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  signatureText: {
    color: 'rgba(0, 255, 0, 0.8)',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  copyButtonText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  infoSection: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 15,
    borderRadius: 12,
  },
  infoText: {
    flex: 1,
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    lineHeight: 18,
  },
  unsupportedSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  unsupportedText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  unsupportedSubtext: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

export default SignMessage;