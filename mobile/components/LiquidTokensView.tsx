import type { AssetBalance } from '@breeztech/breez-sdk-liquid';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useContext, useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { BreezWallet, getBreezNetwork, LBTC_ASSET_IDS } from '@shared/class/wallets/breez-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { NETWORK_LIQUID, NETWORK_LIQUIDTESTNET } from '@shared/types/networks';

const LiquidTokensView: React.FC = () => {
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const [assetBalances, setAssetBalances] = useState<AssetBalance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchBreezAssetBalances = async () => {
      setAssetBalances([]);
      if (network !== NETWORK_LIQUID && network !== NETWORK_LIQUIDTESTNET) {
        setLoading(false);
        return;
      }

      try {
        const mnemonic = await BackgroundExecutor.getSubMnemonic(accountNumber);
        const bw = new BreezWallet(mnemonic, getBreezNetwork(network));
        const balances = await bw.getAssetBalances();
        const filteredBalances = balances.filter((asset) => !Object.values(LBTC_ASSET_IDS).includes(asset.assetId));
        setAssetBalances(filteredBalances);
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
      <View style={styles.loadingContainer}>
        <ThemedText style={styles.loadingText}>Loading assets...</ThemedText>
      </View>
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
    <View style={styles.container}>
      <ThemedText style={styles.title}>Assets</ThemedText>
      <View>
        {assetBalances.map((item) => (
          <View key={item.assetId} style={styles.assetContainer}>
            <View style={styles.assetInfo}>
              <ThemedText style={styles.assetName}>{getAssetName(item)}</ThemedText>
              {item.name && <ThemedText style={styles.assetFullName}>({item.name})</ThemedText>}
            </View>

            <ThemedText style={styles.balance}>{item.balance ? item.balance : item.balanceSat}</ThemedText>

            <View style={styles.buttonContainer}>
              <TouchableOpacity onPress={() => goToSend(item.assetId)} style={styles.sendButton}>
                <Ionicons name="send" size={16} color="rgba(255, 255, 255, 0.8)" />
              </TouchableOpacity>
              <TouchableOpacity onPress={goToReceive} style={styles.receiveButton}>
                <Ionicons name="arrow-down" size={16} color="rgba(255, 255, 255, 0.8)" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

export default LiquidTokensView;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    marginHorizontal: 16,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  title: {
    marginBottom: 16,
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  assetContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  assetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  assetName: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  assetFullName: {
    marginLeft: 5,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  balance: {
    marginLeft: 'auto',
    marginRight: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  sendButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.3)',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  receiveButton: {
    backgroundColor: 'rgba(52, 199, 89, 0.3)',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
});
