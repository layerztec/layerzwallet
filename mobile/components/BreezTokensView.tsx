import type { AssetBalance } from '@breeztech/breez-sdk-liquid';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useContext, useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { getBreezNetwork } from '@/src/modules/breeze-adapter';
import { BreezWallet } from '@shared/class/wallets/breez-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { NETWORK_BREEZ, NETWORK_BREEZTESTNET } from '@shared/types/networks';

const BreezTokensView: React.FC = () => {
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const [assetBalances, setAssetBalances] = useState<AssetBalance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchBreezAssetBalances = async () => {
      setAssetBalances([]);
      if (network !== NETWORK_BREEZ && network !== NETWORK_BREEZTESTNET) {
        setLoading(false);
        return;
      }

      try {
        const mnemonic = await BackgroundExecutor.getSubMnemonic(accountNumber);
        const bw = new BreezWallet(mnemonic, getBreezNetwork(network));
        const balances = await bw.getAssetBalances();

        setAssetBalances(balances);
      } catch (error) {
        console.error('Error fetching Breez asset balances:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBreezAssetBalances();
  }, [network, accountNumber]);

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ThemedText>Loading assets...</ThemedText>
      </ThemedView>
    );
  }

  if (assetBalances.length === 0) {
    return null;
  }

  const getAssetName = (asset: AssetBalance): string => {
    return asset.ticker || asset.assetId.substring(0, 8) + '...';
  };

  const goToSend = (assetId: string) => {
    router.push(`/SendLiquid?assetId=${assetId}`);
  };

  const goToReceive = () => {
    router.push('/Receive');
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Assets</ThemedText>
      <View>
        {assetBalances.map((item) => (
          <ThemedView key={item.assetId} style={styles.assetContainer}>
            <View style={styles.assetInfo}>
              <ThemedText style={styles.assetName}>{getAssetName(item)}</ThemedText>
              {item.name && <ThemedText style={styles.assetFullName}>({item.name})</ThemedText>}
            </View>

            <ThemedText style={styles.balance}>{item.balance ? item.balance : item.balanceSat}</ThemedText>

            <View style={styles.buttonContainer}>
              <TouchableOpacity onPress={() => goToSend(item.assetId)} style={styles.button}>
                <Ionicons name="send" size={16} color="#666" />
              </TouchableOpacity>
              <TouchableOpacity onPress={goToReceive} style={styles.button}>
                <Ionicons name="arrow-down" size={16} color="#666" />
              </TouchableOpacity>
            </View>
          </ThemedView>
        ))}
      </View>
    </ThemedView>
  );
};

export default BreezTokensView;

const styles = StyleSheet.create({
  container: {
    padding: 10,
    marginTop: 10,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  assetContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginVertical: 4,
    marginHorizontal: 8,
  },
  assetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetName: {
    fontWeight: '700',
    fontSize: 14,
  },
  assetFullName: {
    marginLeft: 5,
    color: '#888',
    fontSize: 14,
  },
  balance: {
    fontSize: 14,
    marginLeft: 'auto',
    marginRight: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  button: {
    backgroundColor: 'white',
    padding: 8,
    borderRadius: 4,
  },
});
