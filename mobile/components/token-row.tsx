import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { Ionicons } from '@expo/vector-icons';
import { DEFAULT_NETWORK } from '@shared/config';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useTokenBalance } from '@shared/hooks/useTokenBalance';
import { getTokenList } from '@shared/models/token-list';
import { capitalizeFirstLetter, formatBalance } from '@shared/modules/string-utils';
import { useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';

const TokenRow: React.FC<{ tokenAddress: string }> = ({ tokenAddress }) => {
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const router = useRouter();
  const list = getTokenList(network);
  const token = list.find((token) => token.address === tokenAddress);
  const { balance } = useTokenBalance(network ?? DEFAULT_NETWORK, accountNumber, tokenAddress, BackgroundExecutor);

  // Get theme colors
  const borderColor = useThemeColor({}, 'border');
  const subtle = useThemeColor({}, 'subtleText');
  const accent = useThemeColor({}, 'accent');

  if (!balance) return null;

  const formattedBalance = formatBalance(balance, token?.decimals ?? 1, 2);

  // displaying token only if its balance is above the threshold. Threshold is arbitrary atm, probably
  // should be configurable per token
  if (+formattedBalance === 0) return null;

  return (
    <ThemedView style={[styles.container, { borderColor }]}>
      <View style={styles.tokenInfo}>
        <ThemedText numberOfLines={1} ellipsizeMode="tail" style={styles.tokenName}>
          {token?.name}
        </ThemedText>
        <ThemedText style={[styles.networkName, { color: subtle }]}>({capitalizeFirstLetter(network)})</ThemedText>
      </View>

      <ThemedText numberOfLines={1} style={styles.balance}>
        <ThemedText style={styles.symbol}>{token?.symbol}</ThemedText> {balance ? formattedBalance : ''}
      </ThemedText>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={() => {
            router.push({
              pathname: '/SendTokenEvm',
              params: { contractAddress: token?.address },
            });
          }}
          style={[styles.button, { backgroundColor: accent }]}
        >
          <Ionicons name="send" size={16} color="white" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/receive')} style={[styles.button, { backgroundColor: accent }]}>
          <Ionicons name="arrow-down" size={16} color="white" />
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
    marginVertical: 6,
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 3,
    marginRight: 4,
  },
  tokenName: {
    fontWeight: 'bold',
    fontSize: 16,
    flexShrink: 1,
  },
  networkName: {
    marginLeft: 6,
    fontSize: 14,
  },
  balance: {
    fontSize: 16,
    flex: 2,
    textAlign: 'right',
    marginRight: 16,
  },
  symbol: {
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    padding: 8,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
    height: 32,
  },
});

export default TokenRow;
