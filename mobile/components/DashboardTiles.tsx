import React, { useMemo, useState, useCallback, useRef, useEffect, useContext } from 'react';
import { View, StyleSheet, Dimensions, Text, Image, TouchableOpacity, Animated } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { getAvailableNetworks, NETWORK_BITCOIN, NETWORK_USDT, Networks } from '@shared/types/networks';
import { getNetworkGradient, gradients as sharedGradients } from '@shared/constants/Colors';
import { getIsTestnet, getTickerByNetwork, getDecimalsByNetwork } from '@shared/models/network-getters';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { useCachedBalance } from '@shared/hooks/useCachedBalance';
import { useCachedExchangeRate } from '@shared/hooks/useCachedExchangeRate';
import { capitalizeFirstLetter, formatBalance, formatFiatBalance } from '@shared/modules/string-utils';
import { ThemedText } from '@/components/ThemedText';
import { FlatList } from '@/components/FlatList';

const logo = require('@/assets/images/ui/logo-main-screen.svg');

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width - 40;
const CARD_HEIGHT = 170;

export interface LayerCard {
  name: string;
  ticker: string;
  balance: string;
  usdValue: string;
  color: string;
  icon?: any;
  tags?: string[];
  tokenCount?: number;
  originalIndex?: number;
  networkId: Networks;
}

type LogoItem = { type: 'logo' };
type DashboardListItem = LayerCard | LogoItem;

const isLogoItem = (item: DashboardListItem): item is LogoItem => 'type' in item && item.type === 'logo';

interface DashboardTileProps {
  card: LayerCard;
  index: number;
  currentIndex: number;
  totalCards: number;
  onCardPress: (index: number) => void;
  disableNavigation?: boolean;
}

interface LayerCardTileProps extends DashboardTileProps {
  transitionId: string;
}

const LayerCardTile = ({ card, index, onCardPress, transitionId: _transitionId, disableNavigation = false, accountNumber }: LayerCardTileProps & { accountNumber?: number }) => {
  const router = useRouter();

  const { balance } = useCachedBalance(card.networkId, accountNumber || 0);
  const { exchangeRate } = useCachedExchangeRate(card.networkId, 'USD');
  const [hasTimedOut, setHasTimedOut] = useState(false);

  // Animation for squeeze effect
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => setHasTimedOut(true), 10000);
    return () => clearTimeout(timer);
  }, []);

  const displayCard = useMemo(() => {
    const isTestnet = getIsTestnet(card.networkId as any);
    let formattedBalance = '0.00000';
    let formattedUsdValue = '$0.00';

    if (balance !== undefined && balance !== null) {
      formattedBalance = formatBalance(balance, getDecimalsByNetwork(card.networkId as any), 8);
    } else if (!hasTimedOut) {
      formattedBalance = '···';
    }

    if (isTestnet) {
      formattedUsdValue = 'Testnet';
    } else if (balance !== undefined && balance !== null && exchangeRate) {
      formattedUsdValue = `$${formatFiatBalance(balance, getDecimalsByNetwork(card.networkId as any), +exchangeRate)}`;
    } else {
      formattedUsdValue = '...';
    }

    if (card.networkId === NETWORK_USDT && !Number.isNaN(+formattedBalance)) {
      // dont display usd which is basically same as tokens,
      // and truncate to 2 digits after coma only
      formattedUsdValue = '';
      formattedBalance = String(Math.floor(+formattedBalance * 100) / 100);
    }

    return { ...card, balance: formattedBalance, usdValue: formattedUsdValue };
  }, [card, balance, exchangeRate, hasTimedOut]);
  const gradientColors = useMemo(() => {
    let gradKey: keyof typeof sharedGradients = 'base';
    for (const key of Object.keys(sharedGradients)) {
      if (key.startsWith(card.networkId)) {
        gradKey = key as keyof typeof sharedGradients;
        break;
      }
    }
    return sharedGradients[gradKey];
  }, [card.networkId]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (disableNavigation) {
      onCardPress(index);
      return;
    }
    router.push({
      pathname: '/home' as any,
      params: {
        name: displayCard.name,
        balance: displayCard.balance,
        ticker: displayCard.ticker,
        usdValue: displayCard.usdValue,
        color: displayCard.color,
        tags: JSON.stringify(displayCard.tags || []),
        tokenCount: displayCard.tokenCount?.toString() || '0',
        transitionId: `card-${displayCard.name}-${index}`,
      },
    });
  }, [disableNavigation, onCardPress, index, router, displayCard]);

  // Handle press animations for squeeze effect
  const handlePressIn = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 0.95,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  return (
    <View style={styles.itemContainer}>
      <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
        <LinearGradient colors={gradientColors as [string, string]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.gradientBackground} />
        <TouchableOpacity
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.touchableCard}
          activeOpacity={1}
          delayPressIn={50}
          delayPressOut={50}
          testID={displayCard.networkId ? `network-${displayCard.networkId}` : `card-${displayCard.name.toLowerCase()}`}
        >
          <View style={styles.topRow}>
            <View style={styles.cardHeader}>
              {displayCard.icon ? (
                <View style={styles.iconContainer}>
                  <Image source={displayCard.icon} style={styles.iconImage} resizeMode="contain" />
                </View>
              ) : (
                <View style={styles.iconContainer}>
                  <Text style={styles.iconPlaceholderText}>{displayCard.ticker.charAt(0)}</Text>
                </View>
              )}
              <Text style={styles.cardName}>{displayCard.name}</Text>
            </View>
            <View style={styles.tagsContainer}>
              {displayCard.tokenCount && displayCard.tokenCount > 0 ? (
                <View style={styles.tagBadge}>
                  <Text style={styles.tagText}>
                    {displayCard.tokenCount} Token{displayCard.tokenCount > 1 ? 's' : ''}
                  </Text>
                </View>
              ) : (
                displayCard.tags &&
                displayCard.tags.map((tag: string, i: number) => (
                  <View key={i} style={styles.tagBadge}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))
              )}
            </View>
          </View>

          <View style={styles.bottomRow}>
            <View style={styles.cardBalanceContainer}>
              <ThemedText type="sfProRounded" style={styles.cardBalance}>
                {displayCard.balance || '0'} <ThemedText style={styles.cardTicker}>{displayCard.ticker}</ThemedText>
              </ThemedText>
              <Text style={styles.cardUsdValue}>{displayCard.usdValue || ''}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const useNetworkCards = (accountNumber: number): LayerCard[] => {
  const networks = getAvailableNetworks();

  return useMemo(() => {
    return networks.map((network, index) => {
      const isTestnet = getIsTestnet(network);
      const gradientColors = getNetworkGradient(network);
      const ticker = getTickerByNetwork(network);

      return {
        name: capitalizeFirstLetter(network),
        ticker: ticker,
        balance: '0.00000',
        usdValue: isTestnet ? 'Testnet' : '$0.00',
        color: gradientColors[0],
        icon: null,
        tags: isTestnet ? ['Testnet'] : [],
        tokenCount: 0,
        networkId: network,
        originalIndex: index,
      };
    });
  }, [networks]);
};

interface DashboardTilesProps {
  cards?: LayerCard[];
  onCardPress?: (index: number) => void;
  onClose?: () => void;
  showTitle?: boolean;
  showLogo?: boolean;
}

const DashboardTiles = ({ cards: providedCards, onCardPress: onExternalCardPress, onClose, showTitle = true, showLogo = false }: DashboardTilesProps) => {
  const { accountNumber } = useContext(AccountNumberContext);

  const networkCards = useNetworkCards(accountNumber);
  const cards = providedCards || networkCards;
  const [currentNetworkId, setCurrentNetworkId] = useState<Networks>(NETWORK_BITCOIN);
  const listData = useMemo<DashboardListItem[]>(() => (showLogo ? [{ type: 'logo' as const }, ...cards] : cards), [showLogo, cards]);

  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  useEffect(() => {
    if (cards.length > 0 && cards[0]?.networkId) {
      setCurrentNetworkId(cards[0].networkId);
    }
  }, [cards]);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onClose?.();
  }, [onClose]);

  const handleCardPress = useCallback(
    (index: number) => {
      onExternalCardPress?.(index);
      const selectedCard = cards[index];
      if (selectedCard?.networkId) {
        setCurrentNetworkId(selectedCard.networkId);
      }
    },
    [onExternalCardPress, cards]
  );

  return (
    <View style={styles.dashboardContainer}>
      <View style={styles.container}>
        <View style={styles.selectedNetworkIndicator} testID={`activeNetwork-${currentNetworkId}`}>
          <Text style={styles.hiddenText}>{currentNetworkId}</Text>
        </View>

        <FlatList<DashboardListItem>
          key={`account-${accountNumber}`}
          data={listData}
          keyExtractor={(item, index) => (isLogoItem(item) ? 'logo' : `card-${item.name}-${index}-${accountNumber}`)}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            if (isLogoItem(item)) {
              return (
                <View style={styles.logoContainer}>
                  <ExpoImage source={logo} style={styles.logo} contentFit="contain" />
                </View>
              );
            }

            // Only render LayerCardTile for valid card items
            if (item && item.name && item.networkId) {
              return (
                <LayerCardTile
                  card={item}
                  index={showLogo ? index - 1 : index}
                  currentIndex={0}
                  totalCards={cards.length}
                  onCardPress={handleCardPress}
                  transitionId={`card-${item.name}-${index}`}
                  disableNavigation={!!onExternalCardPress}
                  accountNumber={accountNumber}
                />
              );
            }
            return null;
          }}
        />
      </View>
    </View>
  );
};

export default DashboardTiles;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedNetworkIndicator: {
    position: 'absolute',
    top: 140,
    right: 20,
    padding: 10,
  },
  hiddenText: {
    color: 'transparent',
    fontSize: 1,
  },
  list: {
    flex: 1,
    width: '100%',
  },
  listContent: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 120,
  },
  itemContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 16,
  },
  card: {
    height: CARD_HEIGHT,
    width: CARD_WIDTH,
    backgroundColor: 'transparent',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#111111',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  touchableCard: {
    flex: 1,
  },
  gradientBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardName: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 12,
    flex: 1,
  },
  cardBalanceContainer: {
    alignItems: 'flex-start',
    flex: 1,
    justifyContent: 'flex-end',
  },
  cardBalance: {
    color: 'white',
    fontSize: 20,
    lineHeight: 23,
    textAlign: 'left',
  },
  cardTicker: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: '500',
  },
  cardUsdValue: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    marginTop: 4,
    textAlign: 'left',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  tagBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 6,
    marginTop: 6,
  },
  tagText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconImage: {
    width: 20,
    height: 20,
  },
  iconPlaceholderText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 30,
    paddingBottom: 20,
  },
  logo: {
    width: 120,
    height: 60,
  },
  dashboardContainer: {
    flex: 1,
  },
});
