import React, { useMemo, useState, useCallback, useRef, useEffect, useContext } from 'react';
import { View, StyleSheet, Dimensions, Text, Image, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnUI, runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { getAvailableNetworks, NETWORK_BITCOIN, Networks } from '@shared/types/networks';
import { getNetworkGradient, getNetworkIcon, gradients as sharedGradients } from '@shared/constants/Colors';
import { getIsTestnet, getTickerByNetwork, getDecimalsByNetwork } from '@shared/models/network-getters';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { useCachedBalance } from '@shared/hooks/useCachedBalance';
import { useCachedExchangeRate } from '@shared/hooks/useCachedExchangeRate';
import { capitalizeFirstLetter, formatBalance, formatFiatBalance } from '@shared/modules/string-utils';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width - 40;
const CARD_HEIGHT = 200;
const CARD_STACK_OFFSET = 30;
const BACKGROUND_CARDS_SCALE = [0.92, 0.86, 0.8, 0.74];
const BACKGROUND_CARDS_OPACITY = [1.0, 1.0, 0.95, 0.9];
const ZOOM_SCALE = 2.5;

export interface LayerCard {
  name: string;
  ticker: string;
  balance: string;
  usdValue: string;
  color: string;
  icon?: any;
  iconName?: string;
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

const LayerCardTile = ({ card, index, currentIndex, totalCards, onCardPress, transitionId, disableNavigation = false, accountNumber }: LayerCardTileProps & { accountNumber?: number }) => {
  const router = useRouter();
  const { returnProgress } = useLocalSearchParams();

  const { balance } = useCachedBalance(card.networkId, accountNumber || 0);
  const { exchangeRate } = useCachedExchangeRate(card.networkId, 'USD');
  const [hasTimedOut, setHasTimedOut] = useState(false);

  const cardScale = useSharedValue(1);
  const rotationX = useSharedValue(0);
  const rotationY = useSharedValue(0);
  const wasTapped = useSharedValue(false);

  useEffect(() => {
    const timer = setTimeout(() => setHasTimedOut(true), 10000);
    return () => clearTimeout(timer);
  }, []);

  const relativePosition = index - currentIndex;
  const isFocused = relativePosition === 0;
  const isVisible = Math.abs(relativePosition) <= 4;

  const displayCard = useMemo(() => {
    if (accountNumber === undefined) return card;

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
  }, [card, balance, exchangeRate, hasTimedOut, accountNumber]);
  let gradKey: keyof typeof sharedGradients = 'base';
  for (const key of Object.keys(sharedGradients)) {
    if (key.startsWith(card.networkId)) {
      gradKey = key as keyof typeof sharedGradients;
      break;
    }
  }
  const gradientColors = sharedGradients[gradKey];

  const animatedStyle = useAnimatedStyle(() => {
    if (!isVisible) {
      return {
        opacity: 0,
        transform: [{ scale: 0.7 }, { translateY: relativePosition > 0 ? 300 : -300 }],
        zIndex: -10,
      };
    }

    const distance = Math.abs(relativePosition);
    let scale = 1;
    let opacity = 1;
    let yOffset = 0;
    let zIndex = totalCards;

    if (isFocused) {
      zIndex = totalCards + 100;
    } else if (relativePosition > 0) {
      const stackIndex = Math.min(relativePosition - 1, BACKGROUND_CARDS_SCALE.length - 1);
      scale = BACKGROUND_CARDS_SCALE[stackIndex];
      opacity = BACKGROUND_CARDS_OPACITY[stackIndex];
      yOffset = CARD_STACK_OFFSET * relativePosition;
      zIndex = totalCards - relativePosition + 50;
    } else {
      const stackIndex = Math.min(distance - 1, BACKGROUND_CARDS_SCALE.length - 1);
      scale = BACKGROUND_CARDS_SCALE[stackIndex];
      opacity = BACKGROUND_CARDS_OPACITY[stackIndex];
      yOffset = -CARD_STACK_OFFSET * distance;
      zIndex = totalCards - distance + 50;
    }

    return {
      transform: [
        { scale: withSpring(scale * cardScale.value, { damping: 20, stiffness: 300 }) },
        { translateY: withSpring(yOffset, { damping: 25, stiffness: 300 }) },
        { rotateX: `${rotationX.value}deg` },
        { rotateY: `${rotationY.value}deg` },
      ],
      opacity: withSpring(opacity, { damping: 20, stiffness: 300 }),
      zIndex: zIndex,
      elevation: zIndex,
    };
  }, [relativePosition, totalCards, rotationX, rotationY, cardScale]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!isFocused) {
      onCardPress(index);
      return;
    }

    if (disableNavigation) return;

    wasTapped.value = true;

    const navigatePush = () => {
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

    cardScale.value = withTiming(ZOOM_SCALE, { duration: 400 }, (finished) => {
      if (finished) runOnJS(navigatePush)();
    });
  };

  const handlePressIn = () => {
    if (isFocused) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      rotationX.value = withSpring(-3, { damping: 20, stiffness: 500 });
      rotationY.value = withSpring(2, { damping: 20, stiffness: 500 });
      cardScale.value = withSpring(0.98, { damping: 20, stiffness: 500 });
    } else {
      cardScale.value = withSpring(0.95, { damping: 30, stiffness: 600 });
    }
  };

  const handlePressOut = () => {
    if (isFocused) {
      rotationX.value = withSpring(0, { damping: 20, stiffness: 400 });
      rotationY.value = withSpring(0, { damping: 20, stiffness: 400 });
      cardScale.value = withSpring(1, { damping: 20, stiffness: 400 });
    } else {
      cardScale.value = withSpring(1, { damping: 30, stiffness: 600 });
    }
  };

  useEffect(() => {
    if (returnProgress != null) {
      const p = parseFloat(returnProgress as string);
      runOnUI(() => {
        'worklet';
        cardScale.value = 1;
        rotationX.value = -15 * (1 - p);
        rotationY.value = 15 * (1 - p);
      })();
    }
  }, [returnProgress, cardScale, rotationX, rotationY]);

  useFocusEffect(
    useCallback(() => {
      if (wasTapped.value) {
        cardScale.value = withTiming(1, { duration: 400 });
        rotationX.value = withTiming(0, { duration: 400 });
        rotationY.value = withTiming(0, { duration: 400 });

        setTimeout(() => {
          wasTapped.value = false;
        }, 400);
      }
    }, [cardScale, wasTapped, rotationX, rotationY])
  );

  return (
    <Animated.View style={[styles.cardContainer, animatedStyle]}>
      <Animated.View sharedTransitionTag={transitionId} style={[styles.card]}>
        <LinearGradient colors={gradientColors as [string, string]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.gradientBackground} />
        <TouchableOpacity
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={handlePress}
          style={styles.touchableCard}
          activeOpacity={0.9}
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
      </Animated.View>
    </Animated.View>
  );
};

const useNetworkCards = (accountNumber: number): LayerCard[] => {
  const networks = getAvailableNetworks();

  return useMemo(() => {
    return networks.map((network, index) => {
      const isTestnet = getIsTestnet(network);
      const gradientColors = getNetworkGradient(network);
      const iconName = getNetworkIcon(network);
      const ticker = getTickerByNetwork(network);

      return {
        name: capitalizeFirstLetter(network),
        ticker: ticker,
        balance: '0.00000',
        usdValue: isTestnet ? 'Testnet' : '$0.00',
        color: gradientColors[0],
        icon: null,
        iconName: iconName,
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentNetworkId, setCurrentNetworkId] = useState<Networks>(NETWORK_BITCOIN);
  const opacity = useSharedValue(isNetworkSelector ? 1 : 0);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    return () => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isNetworkSelector) {
      opacity.value = 1;
    } else {
      opacity.value = withTiming(1, { duration: 500 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [opacity, isNetworkSelector]);

  useEffect(() => {
    if (cards.length > 0 && cards[currentIndex]?.networkId) {
      setCurrentNetworkId(cards[currentIndex].networkId);
    }
  }, [cards, currentIndex]);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (onClose) {
      onClose();
    }
    opacity.value = withTiming(0, { duration: 300 });
  }, [opacity, onClose]);

  const containerAnimatedStyle = useAnimatedStyle(
    () => ({
      opacity: opacity.value,
    }),
    [opacity]
  );

  const handleCardPress = useCallback(
    (index: number) => {
      onExternalCardPress?.(index);

      if (index !== currentIndex) {
        setCurrentIndex(index);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (scrollViewRef.current) {
          const screenCenter = height / 2;
          const scrollPosition = index * 50 + height * 0.4 - screenCenter;
          scrollViewRef.current.scrollTo({ y: Math.max(0, scrollPosition), animated: true });
        }
      }

      const selectedCard = cards[index];
      if (selectedCard?.networkId) {
        setCurrentNetworkId(selectedCard.networkId);
      }
    },
    [onExternalCardPress, currentIndex, cards]
  );

  const handleScroll = useCallback(
    (event: any) => {
      const y = event.nativeEvent.contentOffset.y;
      const screenCenter = height / 2;
      const paddingTop = height * 0.4;
      const adjustedY = y + screenCenter - paddingTop;
      const rawIndex = adjustedY / 50;
      let newIndex = Math.round(rawIndex);

      newIndex = Math.max(0, Math.min(cards.length - 1, newIndex));

      if (newIndex !== currentIndex) {
        setCurrentIndex(newIndex);
        const selectedCard = cards[newIndex];
        if (selectedCard?.networkId) {
          setCurrentNetworkId(selectedCard.networkId);
        }

        if (scrollTimeout.current) {
          clearTimeout(scrollTimeout.current);
        }

        scrollTimeout.current = setTimeout(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }, 50);
      }
    },
    [currentIndex, cards]
  );

  return (
    <View style={{ flex: 1 }}>
      <Animated.View style={[styles.container, containerAnimatedStyle]}>
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
          <Text style={styles.hiddenText}>{currentNetworkId} Selected</Text>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          onScrollEndDrag={handleScroll}
          contentInsetAdjustmentBehavior="never"
          removeClippedSubviews={false}
        >
          {cards.map((card, index) => (
            <View key={`card-wrapper-${index}`} style={styles.cardWrapper}>
              <LayerCardTile
                card={card}
                index={index}
                currentIndex={currentIndex}
                totalCards={cards.length}
                onCardPress={handleCardPress}
                transitionId={`card-${card.name}-${index}`}
                disableNavigation={!!onExternalCardPress}
                isNetworkSelector={isNetworkSelector}
                accountNumber={providedCards ? undefined : accountNumber}
              />
            </View>
          ))}
        </ScrollView>
      </Animated.View>
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
  scrollView: {
    flex: 1,
    width: '100%',
    marginTop: height * 0.1,
  },
  scrollContent: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: height * 0.4,
    paddingBottom: height * 0.4,
    minHeight: height,
  },
  cardWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 40,
    marginBottom: 10,
  },
  cardContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
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
