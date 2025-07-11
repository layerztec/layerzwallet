import React, { useContext, useEffect, useState } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, FlatList } from 'react-native';
import assert from 'assert';
import BigNumber from 'bignumber.js';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { Networks } from '@shared/types/networks';
import { capitalizeFirstLetter } from '@shared/modules/string-utils';
import { SwapPair, SwapPlatform } from '@shared/types/swap';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { useBalance } from '@shared/hooks/useBalance';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getSwapPairs, getSwapProvidersList } from '@shared/models/swap-providers-list';

const SwapInterfaceView: React.FC = () => {
  const router = useRouter();
  const [amount, setAmount] = useState<string>('');
  const [targetNetwork, setTargetNetwork] = useState<Networks>();
  const { network, setNetwork } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { balance } = useBalance(network, accountNumber, BackgroundExecutor);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [showNetworkPicker, setShowNetworkPicker] = useState(false);
  const [swapPairs, setSwapPairs] = useState<SwapPair[]>([]);

  useEffect(() => {
    setSwapPairs(getSwapPairs(network, SwapPlatform.MOBILE));
  }, [network]);

  const handleSwap = async (): Promise<string> => {
    setError('');
    assert(balance, 'internal error: balance not loaded');
    assert(targetNetwork, 'internal error: target network not selected');
    const amt = parseFloat(amount);
    assert(!isNaN(amt), 'Invalid amount');
    assert(amt > 0, 'Amount should be > 0');
    const satValueBN = new BigNumber(amt);
    const satValue = satValueBN.multipliedBy(new BigNumber(10).pow(getDecimalsByNetwork(network))).toString(10);
    assert(new BigNumber(balance).gte(satValue), 'Not enough balance');

    const providers = getSwapProvidersList(network);
    const provider = providers.find((p) => p.getSupportedPairs().some((pair) => pair.from === network && pair.to === targetNetwork && pair.platform === SwapPlatform.MOBILE));

    assert(provider, 'internal error: no provider found for the selected networks');

    if (!amount || isNaN(parseFloat(amount))) {
      throw new Error('Invalid amount');
    }

    const destinationAddress = await BackgroundExecutor.getAddress(targetNetwork, accountNumber);
    assert(destinationAddress, 'internal error: no destination address');

    return provider.swap(network, setNetwork, targetNetwork, parseInt(satValue), destinationAddress);
  };

  const handleGo = async () => {
    setIsLoading(true);
    try {
      const url = await handleSwap();
      router.push({ pathname: '/DAppBrowser', params: { url } });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const supportedNetworks = swapPairs.map((pair) => pair.to);

  return (
    <View style={styles.container}>
      <View style={styles.swapRow}>
        <ThemedText style={styles.label}>Swap</ThemedText>

        <TextInput
          style={styles.amountInput}
          placeholder="0.000"
          placeholderTextColor="rgba(255, 255, 255, 0.6)"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
          testID="swap-amount-input"
        />

        <View style={styles.tickerContainer}>
          <ThemedText style={styles.ticker}>
            <ThemedText style={styles.tickerBold}>{getTickerByNetwork(network)}</ThemedText>
          </ThemedText>
        </View>

        <ThemedText style={styles.label}>to</ThemedText>

        <TouchableOpacity style={styles.pickerContainer} onPress={() => setShowNetworkPicker(true)}>
          <ThemedText style={styles.pickerText}>{targetNetwork ? capitalizeFirstLetter(targetNetwork) : 'Select target network'}</ThemedText>
        </TouchableOpacity>

        <Modal visible={showNetworkPicker} transparent={true} animationType="slide" onRequestClose={() => setShowNetworkPicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ThemedText style={styles.modalTitle}>Select Target Network</ThemedText>
              <FlatList
                data={supportedNetworks}
                keyExtractor={(item) => `to-${item}`}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.networkOption}
                    onPress={() => {
                      setTargetNetwork(item);
                      setShowNetworkPicker(false);
                    }}
                  >
                    <ThemedText style={styles.networkOptionText}>{capitalizeFirstLetter(item)}</ThemedText>
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowNetworkPicker(false)}>
                <ThemedText style={styles.closeButtonText}>Close</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {targetNetwork && !isLoading && (
          <TouchableOpacity style={styles.goButton} onPress={handleGo}>
            <ThemedText style={styles.goButtonText}>Go</ThemedText>
          </TouchableOpacity>
        )}

        {isLoading && <ActivityIndicator size="large" color="rgba(255, 255, 255, 0.8)" />}
      </View>

      {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  swapRow: {
    flexDirection: 'column',
    gap: 16,
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  label: {
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  amountInput: {
    height: 50,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: 'white',
    textAlign: 'center',
  },
  tickerContainer: {
    alignItems: 'center',
  },
  ticker: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  tickerBold: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerText: {
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxHeight: '70%',
  },
  modalTitle: {
    marginBottom: 15,
    textAlign: 'center',
    color: '#333',
  },
  networkOption: {
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  networkOptionText: {
    color: '#333',
  },
  closeButton: {
    marginTop: 15,
    backgroundColor: '#000',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
  },
  goButton: {
    backgroundColor: '#000',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  goButtonText: {
    color: 'white',
  },
  errorText: {
    color: '#FF6B6B',
    textAlign: 'center',
    marginTop: 16,
  },
});

export default SwapInterfaceView;
