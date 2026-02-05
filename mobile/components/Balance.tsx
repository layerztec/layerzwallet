import BN from 'bignumber.js';
import PlatformBlurView from '@/components/PlatformBlurView';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useContext, useEffect, useImperativeHandle, useMemo, useState, forwardRef } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Pressable from './Pressable';

import { OnrampProps } from '@/app/Onramp';
import SectionContainer from '@/components/SectionContainer';
import { ThemedText } from '@/components/ThemedText';
import { LayerzStorage } from '@/src/class/layerz-storage';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { getNetworkImageAsset } from '@/utils/networkAssets';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useBalance } from '@shared/hooks/useBalance';
import { useExchangeRate } from '@shared/hooks/useExchangeRate';
import { useTokenBalance } from '@shared/hooks/useTokenBalance';
import { useTokenDiscovery } from '@shared/hooks/useTokenDiscovery';
import { fiatOnRamp } from '@shared/models/fiat-on-ramp';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { capitalizeFirstLetter, formatBalance, formatFiatBalance } from '@shared/modules/string-utils';
import { NETWORK_LIGHTNING, NETWORK_LIGHTNING_TESTNET, NETWORK_LIQUID, NETWORK_LIQUID_TESTNET, NETWORK_ROOTSTOCK, NETWORK_SPARK, NETWORK_USDT, NETWORK_ARK, Networks } from '@shared/types/networks';
import { CachedTokenInfo } from '@shared/types/token-info';
import { USDT_TOKENS } from '@shared/models/token-list';

const Balance = forwardRef<{ refresh: () => void }>((props, ref) => {
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { balance, mutate } = useBalance(network, accountNumber, BackgroundExecutor);
  const { exchangeRate } = useExchangeRate(network, 'USD');
  const ticker = getTickerByNetwork(network);
  const canBuyWithFiat = fiatOnRamp?.[network]?.canBuyWithFiat;

  useImperativeHandle(ref, () => ({
    refresh: () => {
      mutate();
    },
  }));

  const [displayBalance, displaySubBalance] = useMemo(() => {
    const decimals = getDecimalsByNetwork(network);
    if (!balance) return [`—`, '—'];
    const formattedBalance = formatBalance(balance, decimals);
    if (!exchangeRate) return [formattedBalance, '—'];
    const usdValue = formatFiatBalance(balance, decimals, exchangeRate);
    return [formattedBalance, usdValue];
  }, [network, balance, exchangeRate]);

  const handleBuyClick = () => {
    BackgroundExecutor.getAddress(network, accountNumber).then((address) => {
      const params: OnrampProps = { address, network };
      router.push({ pathname: '/Onramp', params });
    });
  };

  return (
    <View style={styles.balanceSection} testID="LayerBalance">
      <View style={styles.balanceContainer}>
        <ThemedText type="sfProRounded" style={styles.balanceAmount} adjustsFontSizeToFit={true} numberOfLines={1} testID="LayerActualBalance">
          {displayBalance} <ThemedText style={styles.balanceTicker}>{ticker}</ThemedText>
        </ThemedText>
        <ThemedText style={styles.balanceUsd}>${displaySubBalance}</ThemedText>
      </View>

      {canBuyWithFiat && (
        <Pressable style={styles.buyButton} onPress={handleBuyClick} activeOpacity={0.8}>
          <ThemedText style={styles.buyButtonText}>Fund</ThemedText>
        </Pressable>
      )}
    </View>
  );
});

Balance.displayName = 'Balance';

type BalanceLightningProps = {
  onSelectNetwork?: (network: Networks) => void;
  selectedNetwork?: Networks;
  showTotalBalance?: boolean;
};

export const BalanceLightning = forwardRef<{ refresh: () => void }, BalanceLightningProps>((props, ref) => {
  const { onSelectNetwork = () => {}, selectedNetwork = undefined, showTotalBalance = true } = props;
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);

  // Lightning network aggregates balances from Spark, Ark, and Liquid networks
  // Each underlying network has its own balance and exchange rate
  // Multiple useBalance hooks are needed since each network manages separate state
  const liquidNetwork = network === NETWORK_LIGHTNING_TESTNET ? NETWORK_LIQUID_TESTNET : NETWORK_LIQUID;
  const { balance: sparkBalance, mutate: mutateSpark } = useBalance(NETWORK_SPARK, accountNumber, BackgroundExecutor);
  const { balance: arkBalance, mutate: mutateArk } = useBalance(NETWORK_ARK, accountNumber, BackgroundExecutor);
  const { balance: liquidBalance, mutate: mutateLiquid } = useBalance(liquidNetwork, accountNumber, BackgroundExecutor);
  const { exchangeRate: sparkExchangeRate } = useExchangeRate(NETWORK_SPARK, 'USD');
  const { exchangeRate: arkExchangeRate } = useExchangeRate(NETWORK_ARK, 'USD');
  const { exchangeRate: liquidExchangeRate } = useExchangeRate(liquidNetwork, 'USD');

  // delay rendering of adjustsFontSizeToFit to avoid layout issues on Android
  const [adjustsFontSizeToFit, setAdjustsFontSizeToFit] = useState(false);
  const handleLayout = (event: LayoutChangeEvent) => {
    if (event.nativeEvent.layout.width > 0) {
      setAdjustsFontSizeToFit(true);
    }
  };

  useImperativeHandle(ref, () => ({
    refresh: () => {
      mutateSpark();
      mutateArk();
      mutateLiquid();
    },
  }));

  const ticker = getTickerByNetwork(network);
  const decimals = getDecimalsByNetwork(network);

  const [displayBalance, displaySubBalance] = useMemo<[string, string]>(() => {
    let pairs: [string | undefined, number | undefined][] = []; // pair of balance and exchange rate
    let totalBalance = BN(0);
    let totalUsdValue = BN(0);
    let noFiat = false;

    if (network === NETWORK_LIGHTNING) {
      pairs = [
        [sparkBalance, sparkExchangeRate],
        [liquidBalance, liquidExchangeRate],
        [arkBalance, arkExchangeRate],
      ];
    } else if (network === NETWORK_LIGHTNING_TESTNET) {
      pairs = [[liquidBalance, liquidExchangeRate]];
    }

    for (const [balance, exchangeRate] of pairs) {
      if (balance === undefined) {
        // if balance is undefined, we can't calculate anything
        return ['—', '—'];
      } else if (balance === '0') {
        // if balance is 0, we don't need to calculate exchange rate
        continue;
      } else if (!exchangeRate) {
        // if there is no exchange rate, we can't calculate fiat value
        totalBalance = totalBalance.plus(BN(balance));
        noFiat = true;
      } else if (exchangeRate) {
        // all good
        totalBalance = totalBalance.plus(BN(balance));
        totalUsdValue = totalUsdValue.plus(BN(balance).times(exchangeRate));
      } else {
        return ['Error', 'Error']; // should never happen
      }
    }

    return [formatBalance(totalBalance.toString(), decimals), noFiat ? '—' : totalUsdValue.dividedBy(BN(10).pow(decimals)).toFixed(2)];
  }, [network, sparkBalance, liquidBalance, decimals, sparkExchangeRate, liquidExchangeRate, arkBalance, arkExchangeRate]);

  const icons = useMemo(() => {
    const networks = network === NETWORK_LIGHTNING ? [NETWORK_SPARK, NETWORK_ARK, NETWORK_LIQUID] : [NETWORK_LIQUID_TESTNET];
    return networks.map((network) => {
      const networkImage = getNetworkImageAsset(network);
      const networkIconContent = networkImage ? <Image source={networkImage} style={styles.balanceNetworkImage} contentFit="contain" /> : null;
      return (
        <PlatformBlurView intensity={40} tint="light" style={styles.balanceNetworkIcon} key={network}>
          {networkIconContent}
        </PlatformBlurView>
      );
    });
  }, [network]);

  const rows = useMemo(() => {
    const networks = network === NETWORK_LIGHTNING ? [NETWORK_SPARK, NETWORK_ARK, NETWORK_LIQUID] : [NETWORK_LIQUID_TESTNET];

    return networks.map((network) => {
      let balance: string | undefined;
      let exchangeRate: number | undefined;
      if (network === NETWORK_ARK) {
        balance = arkBalance;
        exchangeRate = arkExchangeRate;
      } else if (network === NETWORK_SPARK) {
        balance = sparkBalance;
        exchangeRate = sparkExchangeRate;
      } else if (network === NETWORK_LIQUID) {
        balance = liquidBalance;
        exchangeRate = liquidExchangeRate;
      }

      const networkImage = getNetworkImageAsset(network);
      const networkIconContent = networkImage ? <Image source={networkImage} style={styles.networkImage} contentFit="contain" /> : null;
      const formattedBalance = balance !== undefined ? formatBalance(balance, Number(getDecimalsByNetwork(network)), 8) : '—';
      const formattedFiatBalance = exchangeRate !== undefined && balance !== undefined ? '$' + formatFiatBalance(balance, Number(getDecimalsByNetwork(network)), Number(exchangeRate)) : '$—';
      const ticker = getTickerByNetwork(network);

      return (
        <Pressable style={[styles.listBalanceRow, selectedNetwork === network && styles.selectedListBalanceRow]} key={network} onPress={() => onSelectNetwork(network)}>
          <View style={styles.listBalanceRowLabel}>
            <View style={styles.networkIcon}>{networkIconContent}</View>
            <ThemedText style={styles.listBalanceLabel}>{capitalizeFirstLetter(network)}</ThemedText>
          </View>

          <View style={styles.listBalanceValues}>
            <ThemedText style={styles.listBalanceAmount}>
              {formattedBalance} {ticker}
            </ThemedText>
            <ThemedText style={styles.listBalanceFiat}>{formattedFiatBalance}</ThemedText>
          </View>
        </Pressable>
      );
    });
  }, [network, sparkBalance, liquidBalance, sparkExchangeRate, liquidExchangeRate, arkBalance, arkExchangeRate, selectedNetwork, onSelectNetwork]);

  return (
    <>
      {showTotalBalance && (
        <View style={styles.balanceSection} testID="LayerBalance">
          <View style={styles.balanceContainer}>
            <ThemedText onLayout={handleLayout} type="sfProRounded" style={styles.balanceAmount} adjustsFontSizeToFit={adjustsFontSizeToFit} numberOfLines={1} testID="LayerActualBalance">
              {displayBalance} <ThemedText style={styles.balanceTicker}>{ticker}</ThemedText>
            </ThemedText>
            <ThemedText style={styles.balanceUsd}>${displaySubBalance}</ThemedText>
          </View>

          <View style={styles.balanceNetworkIcons}>{icons}</View>
        </View>
      )}

      <SectionContainer contentStyle={styles.listBalanceContent}>{rows}</SectionContainer>
    </>
  );
});

BalanceLightning.displayName = 'BalanceLightning';

type TTokenBalances = Record<string, string>;
type TTokenMap = Record<string, CachedTokenInfo>;

// we need a separate component for each row to call useTokenBalance hook for each token
// balanes then aggregated in parent component
const TokenRow = ({
  network,
  token,
  setTokenBalances,
  onSelect,
  isSelected,
}: {
  network: Networks;
  token: CachedTokenInfo;
  setTokenBalances: React.Dispatch<React.SetStateAction<TTokenBalances>>;
  onSelect?: (tokenId: string, network: Networks) => void;
  isSelected?: boolean;
}) => {
  const { accountNumber } = useContext(AccountNumberContext);
  const { balance } = useTokenBalance(network, accountNumber, token.id, BackgroundExecutor);
  const networkImage = getNetworkImageAsset(network);
  const networkIconContent = networkImage ? <Image source={networkImage} style={styles.networkImage} contentFit="contain" /> : null;

  const formattedBalance = formatBalance(balance ?? token.balance ?? '0', token.decimals, 2 /* only need 2 for USD */);

  useEffect(() => {
    // Use balance from hook if available, otherwise fallback to token.balance from discovery
    const effectiveBalance = balance ?? token.balance;
    if (effectiveBalance === undefined) return;
    setTokenBalances((prev) => ({ ...prev, [token.id]: effectiveBalance }));
  }, [balance, token.balance, token.id, setTokenBalances]);

  const Container = onSelect ? Pressable : View;
  const containerProps = onSelect ? { onPress: () => onSelect(token.id, network), activeOpacity: 0.7 } : {};

  return (
    <Container style={[styles.listBalanceRow, isSelected && styles.selectedListBalanceRow]} {...containerProps}>
      <View style={styles.listBalanceRowLabel}>
        <View style={styles.networkIcon}>{networkIconContent}</View>
        <ThemedText style={styles.listBalanceLabel}>{token.name}</ThemedText>
      </View>
      <View style={styles.listBalanceValues}>
        <ThemedText style={styles.listBalanceAmount}>
          {token.symbol}
          {formattedBalance}
        </ThemedText>
      </View>
    </Container>
  );
};

type BalanceUsdtProps = {
  onSelectToken?: (tokenId: string, network: Networks) => void;
  selectedToken?: string;
  showTotalBalance?: boolean;
};

// Balance component for USDT network (aggregates tokens from Rootstock, Liquid, and Spark)
export const BalanceUsdt = forwardRef<{ refresh: () => void }, BalanceUsdtProps>(({ onSelectToken = undefined, selectedToken = undefined, showTotalBalance = true }, ref) => {
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { tokenList: rsTokenListOrig, mutate: mutateRsTokens } = useTokenDiscovery(NETWORK_ROOTSTOCK, accountNumber, BackgroundExecutor, LayerzStorage);
  const { tokenList: liquidTokenListOrig, mutate: mutateLiquidTokens } = useTokenDiscovery(NETWORK_LIQUID, accountNumber, BackgroundExecutor, LayerzStorage);
  const { tokenList: sparkTokenListOrig, mutate: mutateSparkTokens } = useTokenDiscovery(NETWORK_SPARK, accountNumber, BackgroundExecutor, LayerzStorage);
  const [tokenBalances, setTokenBalances] = useState<TTokenBalances>({});
  const ticker = getTickerByNetwork(network);

  // delay rendering of adjustsFontSizeToFit to avoid layout issues on Android
  const [adjustsFontSizeToFit, setAdjustsFontSizeToFit] = useState(false);
  const handleLayout = (event: LayoutChangeEvent) => {
    if (event.nativeEvent.layout.width > 0) {
      setAdjustsFontSizeToFit(true);
    }
  };

  useImperativeHandle(ref, () => ({
    refresh: () => {
      mutateRsTokens();
      mutateLiquidTokens();
      mutateSparkTokens();
    },
  }));

  const rsTokenMap = useMemo<TTokenMap>(() => {
    const map: TTokenMap = {};
    for (const token of rsTokenListOrig) {
      map[token.id] = token;
    }
    for (const token of liquidTokenListOrig) {
      map[token.id] = token;
    }
    for (const token of sparkTokenListOrig) {
      map[token.id] = {
        ...token,
        // hacks to make USDB look better on USDT network screen:
        name: token.symbol,
        symbol: '$',
      };
    }
    return map;
  }, [rsTokenListOrig, liquidTokenListOrig, sparkTokenListOrig]);

  const displayBalance = useMemo(() => {
    let b = BN(0);
    for (const [id, balance] of Object.entries(tokenBalances)) {
      if (!rsTokenMap[id]) continue;
      b = b.plus(BN(balance).dividedBy(10 ** rsTokenMap[id].decimals));
    }
    return b.toFixed(2);
  }, [tokenBalances, rsTokenMap]);

  const rows = useMemo(() => {
    const result = [];
    for (const network of [NETWORK_LIQUID, NETWORK_ROOTSTOCK, NETWORK_SPARK]) {
      const tokens = USDT_TOKENS[network];
      for (const token of tokens) {
        if (!rsTokenMap[token]) continue;
        result.push(<TokenRow key={token} network={network as Networks} token={rsTokenMap[token]} setTokenBalances={setTokenBalances} onSelect={onSelectToken} isSelected={selectedToken === token} />);
      }
    }
    return result;
  }, [rsTokenMap, onSelectToken, selectedToken]);

  const icons = useMemo(() => {
    const networks = [NETWORK_ROOTSTOCK, NETWORK_LIQUID, NETWORK_SPARK];
    return networks.map((network) => {
      const networkImage = getNetworkImageAsset(network);
      const networkIconContent = networkImage ? <Image source={networkImage} style={styles.balanceNetworkImage} contentFit="contain" /> : null;
      return (
        <PlatformBlurView intensity={40} tint="light" style={styles.balanceNetworkIcon} key={network}>
          {networkIconContent}
        </PlatformBlurView>
      );
    });
  }, []);

  return (
    <>
      {showTotalBalance && (
        <View style={styles.balanceSection} testID="LayerBalance">
          <View style={styles.balanceContainer}>
            <ThemedText onLayout={handleLayout} type="sfProRounded" style={styles.balanceAmount} adjustsFontSizeToFit={adjustsFontSizeToFit} numberOfLines={1} testID="LayerActualBalance">
              {displayBalance} <ThemedText style={styles.balanceTicker}>{ticker}</ThemedText>
            </ThemedText>
          </View>

          <View style={styles.balanceNetworkIcons}>{icons}</View>
        </View>
      )}

      <SectionContainer contentStyle={styles.listBalanceContent}>{rows}</SectionContainer>
    </>
  );
});

BalanceUsdt.displayName = 'BalanceUsdt';

const BalanceRoot = forwardRef<{ refresh: () => void }>((props, ref) => {
  const { network } = useContext(NetworkContext);

  if (network === NETWORK_LIGHTNING || network === NETWORK_LIGHTNING_TESTNET) {
    return <BalanceLightning ref={ref} />;
  }
  if (network === NETWORK_USDT) {
    return <BalanceUsdt ref={ref} />;
  }
  return <Balance ref={ref} />;
});

BalanceRoot.displayName = 'BalanceRoot';

export default BalanceRoot;

const styles = StyleSheet.create({
  balanceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  balanceContainer: {
    flex: 1,
  },
  balanceAmount: {
    color: 'white',
    marginRight: 4,
  },
  balanceNetworkIcons: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    marginLeft: 10,
    marginTop: 4,
  },
  balanceNetworkImage: {
    width: 20,
    height: 20,
  },
  balanceNetworkIcon: {
    width: 30,
    height: 30,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -10,
    overflow: 'hidden',
  },
  balanceTicker: {
    marginLeft: 4,
    fontSize: 24,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  balanceUsd: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  buyButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buyButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  transactionsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    overflow: 'hidden',
  },
  networkIcon: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  networkImage: {
    width: 24,
    height: 24,
  },
  listBalanceContent: {
    paddingVertical: 8,
    gap: 6,
  },
  listBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  listBalanceRowLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listBalanceLabel: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 15,
    fontWeight: '500',
  },
  listBalanceValues: {
    marginVertical: -8,
  },
  listBalanceAmount: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    textAlign: 'right',
    fontWeight: '500',
  },
  listBalanceFiat: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    textAlign: 'right',
  },
  selectedListBalanceRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});
