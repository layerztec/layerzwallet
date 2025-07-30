import type { AssetBalance } from '@breeztech/breez-sdk-liquid';
import { useRouter } from 'expo-router';
import React, { useContext, useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';

import { ThemedText } from '@/components/ThemedText';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { BreezWallet, getBreezNetwork, LBTC_ASSET_IDS } from '@shared/class/wallets/breez-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { NETWORK_LIQUID, NETWORK_LIQUIDTESTNET } from '@shared/types/networks';
import { getTokenIconColor } from '@shared/models/token-list';

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
      <BlurView intensity={50} tint="dark" style={styles.loadingContainer}>
        <ThemedText style={styles.loadingText}>Loading assets...</ThemedText>
      </BlurView>
    );
  }

  if (assetBalances.length === 0) {
    return null;
  }

  const getAssetName = (asset: AssetBalance): string => {
    return asset.ticker || asset.assetId.substring(0, 8) + '...';
  };

  const getAssetDisplayName = (asset: AssetBalance): string => {
    return asset.name || asset.ticker || 'Unknown Asset';
  };

  const goToSend = (assetId: string) => {
    router.push(`/SendLiquid?assetId=${assetId}`);
  };

  return (
    <BlurView intensity={50} tint="dark" style={styles.container}>
      <ThemedText style={styles.title}>Assets</ThemedText>
      <View style={styles.assetsList}>
        {assetBalances.map((item) => {
          const iconColor = getTokenIconColor(item.name);
          const assetSymbol = item.ticker || getAssetName(item);

          return (
            <TouchableOpacity key={item.assetId} style={styles.assetRow} onPress={() => goToSend(item.assetId)} activeOpacity={0.7}>
              {/* Asset Icon */}
              <View style={[styles.assetIcon, { backgroundColor: iconColor }]}>
                <ThemedText style={styles.assetIconText}>{assetSymbol.charAt(0).toUpperCase()}</ThemedText>
              </View>

              {/* Asset Name */}
              <ThemedText style={styles.assetName}>{getAssetDisplayName(item)}</ThemedText>

              {/* Asset Amount and Price */}
              <View style={styles.assetAmounts}>
                <ThemedText style={styles.assetAmount}>
                  {item.balance ? item.balance : item.balanceSat} {assetSymbol}
                </ThemedText>
                <ThemedText style={styles.assetPrice}>$TODO</ThemedText>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </BlurView>
  );
};

export default LiquidTokensView;

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
  },
  loadingContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    overflow: 'hidden',
  },
  loadingText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  title: {
    fontSize: 20,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 24,
  },
  assetsList: {
    gap: 16,
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
  },
  assetIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  assetIconText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  assetName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
    flex: 1,
  },
  assetAmounts: {
    alignItems: 'flex-end',
  },
  assetAmount: {
    fontSize: 15,
    fontWeight: '400',
    color: '#ffffff',
    marginBottom: 2,
  },
  assetPrice: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.3)',
  },
});
