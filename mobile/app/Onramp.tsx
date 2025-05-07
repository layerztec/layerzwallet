import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import WebView from 'react-native-webview';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

export type OnrampProps = {
  address: string; // bitcoin address to receive coins to
};

const Onramp: React.FC = () => {
  const params = useLocalSearchParams<OnrampProps>();
  const { address } = params;

  const handleCopyAddress = () => {
    // Logic to copy the address to clipboard
  };

  // @see https://docs.onramper.com/docs/integrating-in-webviews
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="headline" style={styles.title}>
        Onramp
      </ThemedText>
      <ThemedText type="paragraph" style={styles.infoText}>
        Buy Bitcoin directly to your wallet address.
      </ThemedText>
      <ThemedText type="paragraph" style={styles.addressLabel}>
        Your Address:
      </ThemedText>
      <ThemedText type="paragraph" style={styles.address}>
        {address}
      </ThemedText>
      <TouchableOpacity style={styles.copyButton} onPress={handleCopyAddress}>
        <ThemedText type="paragraph" style={styles.copyButtonText}>
          Copy Address
        </ThemedText>
      </TouchableOpacity>
      <WebView
        originWhitelist={['https://*', 'http://*', 'about:blank', 'about:srcdoc']}
        allowsInlineMediaPlayback={true}
        style={{ flex: 1 }}
        source={{ uri: `https://layerztec.github.io/website/onramp/?address=${address}` }}
      />
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  infoText: {
    fontSize: 16,
    marginBottom: 8,
  },
  addressLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  address: {
    fontSize: 16,
    marginBottom: 16,
  },
  copyButton: {
    padding: 8,
    backgroundColor: '#007BFF',
    borderRadius: 4,
    marginBottom: 16,
  },
  copyButtonText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
});

export default Onramp;
