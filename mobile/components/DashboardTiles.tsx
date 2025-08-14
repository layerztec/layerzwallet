import React, { useMemo, useState, useCallback, useRef, useEffect, useContext } from 'react';
import { View, StyleSheet, Dimensions, Text, Image, TouchableOpacity, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { getAvailableNetworks, NETWORK_BITCOIN, Networks } from '@shared/types/networks';
import { getNetworkGradient, gradients as sharedGradients } from '@shared/constants/Colors';
import { getIsTestnet, getTickerByNetwork, getDecimalsByNetwork } from '@shared/models/network-getters';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { useCachedBalance } from '@shared/hooks/useCachedBalance';
import { useCachedExchangeRate } from '@shared/hooks/useCachedExchangeRate';
import { capitalizeFirstLetter, formatBalance, formatFiatBalance } from '@shared/modules/string-utils';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width - 40;
const CARD_HEIGHT = 200;

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

interface DashboardTileProps {
  card: LayerCard;
  index: number;
  currentIndex: number;
  totalCards: number;
  onCardPress: (index: number) => void;
  disableNavigation?: boolean;
  isNetworkSelector?: boolean;
}

interface LayerCardTileProps extends DashboardTileProps {
  transitionId: string;
}

const LayerCardTile = ({ card, index, onCardPress, transitionId: _transitionId, disableNavigation = false, accountNumber }: LayerCardTileProps & { accountNumber?: number }) => {
  const router = useRouter();

  const { balance } = useCachedBalance(card.networkId, accountNumber || 0);
  const { exchangeRate } = useCachedExchangeRate(card.networkId, 'USD');
  const [hasTimedOut, setHasTimedOut] = useState(false);

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

    return { ...card, balance: formattedBalance, usdValue: formattedUsdValue };
  }, [card, balance, exchangeRate, hasTimedOut]);
  let gradKey: keyof typeof sharedGradients = 'base';
  for (const key of Object.keys(sharedGradients)) {
    if (key.startsWith(card.networkId)) {
      gradKey = key as keyof typeof sharedGradients;
      break;
    }
  }
  const gradientColors = sharedGradients[gradKey];

  const handlePress = () => {
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
  };

  return (
    <View style={styles.itemContainer}>
      <View style={styles.card}>
        <LinearGradient colors={gradientColors as [string, string]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.gradientBackground} />
        <TouchableOpacity
          onPress={handlePress}
          style={styles.touchableCard}
          activeOpacity={0.9}
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
            <Text style={styles.cardName}>{displayCard.name}</Text>
            <View style={styles.cardBalanceContainer}>
              <Text style={styles.cardBalance}>
                {displayCard.balance || '0'} {displayCard.ticker}
              </Text>
              <Text style={styles.cardUsdValue}>{displayCard.usdValue || '0.00'}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
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
  isNetworkSelector?: boolean;
}

const DashboardTiles = ({ cards: providedCards, onCardPress: onExternalCardPress, onClose, isNetworkSelector = false }: DashboardTilesProps) => {
  const { accountNumber } = useContext(AccountNumberContext);

  const networkCards = useNetworkCards(accountNumber);
  const cards = providedCards || networkCards;
  const [currentNetworkId, setCurrentNetworkId] = useState<Networks>(NETWORK_BITCOIN);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!isNetworkSelector) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [isNetworkSelector]);

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
    <View style={{ flex: 1 }}>
      <View style={styles.container}>
        <BlurView intensity={50} tint="dark" style={styles.backgroundBlur} pointerEvents="none" />

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Select Layer</Text>
          {onClose && (
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.selectedNetworkIndicator} testID={`activeNetwork-${currentNetworkId}`}>
          <Text style={styles.hiddenText}>{currentNetworkId}</Text>
        </View>

        <FlatList
          ref={flatListRef}
          key={`account-${accountNumber}`}
          data={cards}
          keyExtractor={(item, index) => `card-${item.name}-${index}-${accountNumber}`}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: card, index }) => (
            <LayerCardTile
              card={card}
              index={index}
              currentIndex={0}
              totalCards={cards.length}
              onCardPress={handleCardPress}
              transitionId={`card-${card.name}-${index}`}
              disableNavigation={!!onExternalCardPress}
              isNetworkSelector={isNetworkSelector}
              accountNumber={providedCards ? undefined : accountNumber}
            />
          )}
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
  backgroundBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 1000,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    padding: 10,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
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
    marginTop: height * 0.12,
  },
  listContent: {
    alignItems: 'center',
    paddingTop: 120,
    paddingBottom: 40,
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
    shadowColor: '#000',
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
  },
  cardIcon: {
    width: 44,
    height: 44,
    marginRight: 12,
  },
  cardIconPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardName: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 12,
  },
  cardBalanceContainer: {
    alignItems: 'flex-end',
    flex: 1,
    justifyContent: 'flex-end',
  },
  cardBalance: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  cardUsdValue: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    marginTop: 4,
    textAlign: 'right',
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
  addLayerButton: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  addLayerText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
