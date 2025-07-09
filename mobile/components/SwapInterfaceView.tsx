import React, { useContext, useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, FlatList } from 'react-native';
import assert from 'assert';
import BigNumber from 'bignumber.js';
import { useRouter } from 'expo-router';

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
        <Text style={styles.label}>Swap</Text>

        <TextInput style={styles.amountInput} placeholder="0.000" keyboardType="numeric" value={amount} onChangeText={setAmount} testID="swap-amount-input" />

        <View style={styles.tickerContainer}>
          <Text style={styles.ticker}>
            <Text style={styles.tickerBold}>{getTickerByNetwork(network)}</Text>
          </Text>
        </View>

        <Text style={styles.label}>to</Text>

        <TouchableOpacity style={styles.pickerContainer} onPress={() => setShowNetworkPicker(true)}>
          <Text style={styles.pickerText}>{targetNetwork ? capitalizeFirstLetter(targetNetwork) : 'Select target network'}</Text>
        </TouchableOpacity>

        <Modal visible={showNetworkPicker} transparent={true} animationType="slide" onRequestClose={() => setShowNetworkPicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Target Network</Text>
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
                    <Text style={styles.networkOptionText}>{capitalizeFirstLetter(item)}</Text>
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowNetworkPicker(false)}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {targetNetwork && !isLoading && (
          <TouchableOpacity style={styles.goButton} onPress={handleGo}>
            <Text style={styles.goButtonText}>Go</Text>
          </TouchableOpacity>
        )}

        {isLoading && <ActivityIndicator size="large" color="#282c34" />}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: '#282c34',
  },
  amountInput: {
    width: '25%',
    minWidth: 80,
    height: 40,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#282c34',
    borderRadius: 5,
    fontSize: 16,
    color: '#282c34',
    backgroundColor: 'white',
  },
  tickerContainer: {
    flex: 1,
    minWidth: 60,
  },
  ticker: {
    fontSize: 14,
  },
  tickerBold: {
    fontWeight: 'bold',
  },
  pickerContainer: {
    flex: 1,
    minWidth: 150,
    borderWidth: 1,
    borderColor: '#282c34',
    borderRadius: 5,
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  pickerText: {
    fontSize: 16,
    color: '#282c34',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#282c34',
  },
  networkOption: {
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  networkOptionText: {
    fontSize: 16,
    color: '#282c34',
  },
  closeButton: {
    marginTop: 15,
    backgroundColor: '#282c34',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  goButton: {
    backgroundColor: '#282c34',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'white',
  },
  goButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: 'red',
    fontSize: 14,
    marginTop: 10,
  },
});

export default SwapInterfaceView;
