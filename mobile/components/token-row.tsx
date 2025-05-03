import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/ThemeContext';
import Button from '@/components/ui/Button';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { DEFAULT_NETWORK } from '@shared/config';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useTokenBalance } from '@shared/hooks/useTokenBalance';
import { getTokenList } from '@shared/models/token-list';
import { capitalizeFirstLetter, formatBalance } from '@shared/modules/string-utils';
import { useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { StyleSheet, View } from 'react-native';

const TokenRow: React.FC<{ tokenAddress: string }> = ({ tokenAddress }) => {
  const { getColor } = useTheme();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const router = useRouter();
  const list = getTokenList(network);
  const token = list.find((token) => token.address === tokenAddress);

  const { balance } = useTokenBalance(
    {
      executor: BackgroundExecutor,
      token: token?.address || '',
      network: network || DEFAULT_NETWORK,
      accountNumber,
    },
    {
      refreshInterval: 30000,
    }
  );

  if (!token) {
    return null;
  }

  const handleSend = () => {
    router.push({
      pathname: '/SendTokenEvm',
      params: { contractAddress: token?.address },
    });
  };

  const handleReceive = () => {
    router.push('/receive');
  };

  return (
    <ThemedView style={[styles.container, { borderColor: getColor('border') }]}>
      <View style={styles.tokenInfo}>
        <ThemedText style={styles.tokenName}>{token?.name}</ThemedText>
        <ThemedText style={styles.networkName}>({capitalizeFirstLetter(network)})</ThemedText>
      </View>

      <View style={styles.balanceSection}>
        <ThemedText style={styles.balance}>
          <ThemedText style={styles.symbol}>{token?.symbol}</ThemedText> {balance ? formatBalance(balance, token?.decimals ?? 1, 2) : '0'}
        </ThemedText>
        <View style={styles.buttonContainer}>
          <Button variant="send" onPress={handleSend} size="small" style={styles.actionButton} title="" iconOnly />
          <Button variant="receive" onPress={handleReceive} size="small" style={styles.actionButton} title="" iconOnly />
        </View>
      </View>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginVertical: 4,
    marginHorizontal: 8,
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenName: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  networkName: {
    marginLeft: 5,
    fontSize: 12,
  },
  balanceSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balance: {
    fontSize: 14,
    marginLeft: 'auto',
    marginRight: 16,
  },
  symbol: {
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  actionButton: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 8,
  },
});

export default TokenRow;
