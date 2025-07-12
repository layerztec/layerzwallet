import React, { useMemo, useState, useCallback, useRef, useEffect, useContext } from 'react';
import { View, StyleSheet, Dimensions, Text, Image, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnUI, runOnJS, interpolate, useAnimatedScrollHandler, useAnimatedReaction } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { getAvailableNetworks } from '@shared/types/networks';
import { getNetworkGradient, getNetworkIcon } from '@shared/constants/Colors';
import { getIsTestnet, getTickerByNetwork, getDecimalsByNetwork } from '@shared/models/network-getters';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { useBalance } from '@shared/hooks/useBalance';
import { useExchangeRate } from '@shared/hooks/useExchangeRate';
import { formatBalance, formatFiatBalance } from '@shared/modules/string-utils';
import { BackgroundExecutor } from '@/src/modules/background-executor';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width - 32;
const CARD_HEIGHT = 200;
const FOCUSED_SCALE = 1.0;
const UNFOCUSED_SCALE = 0.88;
const ZOOM_SCALE = 2.5;
const CARD_SPACING = -50;
const SCROLL_SNAP_THRESHOLD = CARD_HEIGHT + CARD_SPACING;

interface LayerCard {
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
  networkId?: string;
}

interface DashboardTileProps {
  card: LayerCard;
  index: number;
  cardPosition: number;
  scrollY: Animated.SharedValue<number>;
  selectedIndex: number;
  onCardPress: (index: number) => void;
  totalCards: number;
  disableNavigation?: boolean;
  isNetworkSelector?: boolean;
}

interface LayerCardTileProps extends DashboardTileProps {
  transitionId: string;
}

const LayerCardTile = ({ card, index, cardPosition, scrollY, selectedIndex, onCardPress, transitionId, totalCards, disableNavigation = false, isNetworkSelector = false }: LayerCardTileProps) => {
  const router = useRouter();
  const { returnProgress } = useLocalSearchParams();

  const cardScale = useSharedValue(UNFOCUSED_SCALE);
  const cardOpacity = useSharedValue(isNetworkSelector ? 1 : 0.6); // Start with full opacity for network selector
  const cardY = useSharedValue(0);
  const cardX = useSharedValue(0);
  const rotationX = useSharedValue(0);
  const rotationY = useSharedValue(0);
  const wasTapped = useSharedValue(false);
  const isCurrentlySelected = useSharedValue(false);
  const savedPosition = useSharedValue(0);

  useEffect(() => {
    if (selectedIndex >= 0 && selectedIndex !== index) {
      const slideDirection = index < selectedIndex ? -1 : 1;
      const slideDistance = slideDirection * (isNetworkSelector ? 200 : 400); // Shorter distance for smoother feel

      cardY.value = withTiming(slideDistance, {
        duration: isNetworkSelector ? 250 : 350, // Faster for network selector
      });
      cardOpacity.value = withTiming(isNetworkSelector ? 0.3 : 0, {
        // Don't go to complete 0 for smoother feel
        duration: isNetworkSelector ? 250 : 350,
      });
    } else if (selectedIndex < 0) {
      if (!wasTapped.value) {
        cardY.value = withSpring(0, {
          damping: isNetworkSelector ? 35 : 30, // Slightly more damping for smoother feel
          stiffness: isNetworkSelector ? 500 : 400, // Higher stiffness for quicker settle
          mass: 0.5,
        });

        // Ensure opacity returns to 1 smoothly
        if (isNetworkSelector) {
          cardOpacity.value = withTiming(1, {
            duration: 200,
          });
        }
      }
    }
  }, [selectedIndex, index, cardY, cardOpacity, wasTapped, isNetworkSelector]);

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';

    // Super smooth animations for network selector
    if (isNetworkSelector) {
      if (selectedIndex >= 0 && selectedIndex !== index) {
        return {
          transform: [{ translateY: cardY.value }, { scale: 0.95 }],
          opacity: cardOpacity.value,
          elevation: 0,
          zIndex: 0,
        };
      }

      // For network selector, create smooth distance-based animations
      const centerY = height / 2 - CARD_HEIGHT / 2;
      const currentCardY = cardPosition - scrollY.value + centerY;
      const distanceFromCenter = Math.abs(currentCardY - centerY);

      // Smooth scale transition (no abrupt changes)
      const maxDistance = height * 0.8; // Increased range for smoother transitions
      const scale = interpolate(distanceFromCenter, [0, maxDistance * 0.3, maxDistance], [1.0, 0.98, 0.9], 'clamp');

      // Super smooth opacity transition (no sudden drops)
      const opacity = interpolate(distanceFromCenter, [0, maxDistance * 0.5, maxDistance], [1.0, 0.95, 0.3], 'clamp');

      // Smooth elevation transition
      const elevation = interpolate(distanceFromCenter, [0, maxDistance], [8, 2], 'clamp');

      // Smooth z-index (no big jumps)
      const zIndex = Math.round(interpolate(distanceFromCenter, [0, maxDistance], [100, 10], 'clamp'));

      return {
        transform: [{ translateY: cardY.value }, { scale: isNaN(scale) ? 1 : scale }],
        opacity: Math.max(0.05, Math.min(1, isNaN(opacity) ? 1 : opacity)),
        elevation: Math.max(0, isNaN(elevation) ? 5 : elevation),
        zIndex: isNaN(zIndex) ? 50 : zIndex,
      };
    }

    // Original complex animations for dashboard (also improved)
    if (isCurrentlySelected.value) {
      return {
        transform: [{ translateY: cardY.value }, { scale: cardScale.value }, { perspective: 1000 }],
        opacity: cardOpacity.value,
        elevation: 50,
        zIndex: 500,
      };
    }

    if (selectedIndex >= 0 && selectedIndex !== index) {
      return {
        transform: [{ translateY: cardY.value }, { translateX: cardX.value }, { scale: cardScale.value }, { perspective: 1000 }],
        opacity: cardOpacity.value,
        elevation: 0,
        zIndex: 0,
      };
    }

    try {
      const centerY = height / 2 - CARD_HEIGHT / 2;
      const currentCardY = cardPosition - scrollY.value + centerY;
      const rawDistanceFromCenter = Math.abs(currentCardY - centerY);

      // Improved: Smoother fallback with gradual transition instead of abrupt change
      if (!isFinite(rawDistanceFromCenter) || rawDistanceFromCenter < 0) {
        return {
          transform: [{ translateY: 0 }, { translateX: 0 }, { scale: UNFOCUSED_SCALE }, { rotateZ: '0deg' }, { perspective: 1000 }],
          opacity: 0.3, // Increased from 0.6 for consistency
          elevation: 3,
          zIndex: 5,
          borderWidth: 0,
          borderColor: 'transparent',
        };
      }

      // Use raw distance without hard clamping to prevent abrupt clipping
      const distanceFromCenter = Math.max(0, rawDistanceFromCenter);

      // Define ranges for smooth transitions
      const scaleRange = SCROLL_SNAP_THRESHOLD * 0.75;
      const opacityRange1 = SCROLL_SNAP_THRESHOLD * 0.75;
      const opacityRange2 = SCROLL_SNAP_THRESHOLD * 3.5; // Extended for ultra-smooth fade
      const zIndexRange = SCROLL_SNAP_THRESHOLD * 0.8;
      const maxRange = height * 4; // Extended but with smooth transitions

      const scaleThreshold = scaleRange;
      const currentScale = interpolate(distanceFromCenter, [0, scaleThreshold], [FOCUSED_SCALE, UNFOCUSED_SCALE], 'clamp');

      // Ultra-smooth opacity with extended range to prevent abrupt clipping
      const currentOpacity = interpolate(
        distanceFromCenter,
        [0, opacityRange1, opacityRange2, maxRange],
        [1.0, 0.9, 0.2, 0.05], // Extended range with very gradual fade
        'clamp'
      );

      const screenCenter = height / 2;
      const isAboveCenter = currentCardY < screenCenter;

      // Ultra-smooth z-index transitions with extended range
      const cardZIndex = isAboveCenter
        ? interpolate(distanceFromCenter, [0, zIndexRange, opacityRange2, maxRange], [1000, 400, 50, 1], 'clamp')
        : interpolate(distanceFromCenter, [0, zIndexRange, opacityRange2, maxRange], [1000, 200, 25, 1], 'clamp');

      const cardElevation = isAboveCenter
        ? interpolate(distanceFromCenter, [0, zIndexRange, opacityRange2, maxRange], [30, 15, 5, 0], 'clamp')
        : interpolate(distanceFromCenter, [0, zIndexRange, opacityRange2, maxRange], [30, 10, 3, 0], 'clamp');

      const focusedOffset = interpolate(distanceFromCenter, [0, scaleThreshold], [-2, 0], 'clamp');

      // Smoother stacking offset (no abrupt jump)
      const stackingThreshold = scaleThreshold * 1.2; // Reduced multiplier for smoother transition
      const stackingOffset = isAboveCenter
        ? interpolate(distanceFromCenter, [0, stackingThreshold, opacityRange2], [0, -3, -5], 'clamp')
        : interpolate(distanceFromCenter, [0, stackingThreshold, opacityRange2], [0, 60, 100], 'clamp');

      const borderThreshold = SCROLL_SNAP_THRESHOLD * 0.5;
      const borderWidth = interpolate(distanceFromCenter, [0, borderThreshold], [2, 0], 'clamp');
      const borderOpacity = interpolate(distanceFromCenter, [0, borderThreshold], [0.8, 0], 'clamp');
      const safeBorderOpacity = Math.max(0, Math.min(1, isNaN(borderOpacity) ? 0 : borderOpacity));
      const borderColor = `rgba(255, 255, 255, ${safeBorderOpacity.toFixed(3)})`;

      // Smoother rotation
      const rotationAngle = interpolate(distanceFromCenter, [0, scaleThreshold * 2], [0, isAboveCenter ? -0.5 : 0.5], 'clamp');

      return {
        transform: [
          { translateY: cardY.value + focusedOffset + stackingOffset },
          { translateX: cardX.value },
          { scale: isNaN(currentScale) ? 1 : currentScale },
          { rotateZ: `${rotationAngle}deg` },
          { perspective: 1000 },
        ],
        opacity: Math.max(0.05, Math.min(1, isNaN(currentOpacity) ? 1 : currentOpacity)), // Minimum 0.05 to prevent abrupt clipping
        elevation: Math.max(0, isNaN(cardElevation) ? 0 : cardElevation),
        zIndex: isNaN(cardZIndex) ? 0 : Math.round(cardZIndex),
        borderWidth: Math.max(0, isNaN(borderWidth) ? 0 : borderWidth),
        borderColor,
      };
    } catch (error) {
      return {
        transform: [{ translateY: 0 }, { translateX: 0 }, { scale: UNFOCUSED_SCALE }, { rotateZ: '0deg' }, { perspective: 1000 }],
        opacity: 0.3, // Improved fallback opacity
        elevation: 3,
        zIndex: 5,
        borderWidth: 0,
        borderColor: 'transparent',
      };
    }
  }, [selectedIndex, scrollY, isNetworkSelector, cardPosition, cardY, cardX, cardScale, cardOpacity, isCurrentlySelected]);

  const handlePress = () => {
    // Lighter haptic feedback for network selector
    if (isNetworkSelector) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    const actualIndex = card.originalIndex !== undefined ? card.originalIndex : index;
    onCardPress(actualIndex);

    if (disableNavigation) return;

    savedPosition.value = cardPosition - scrollY.value;
    wasTapped.value = true;
    isCurrentlySelected.value = true;

    const navigatePush = () => {
      router.push({
        pathname: '/home' as any,
        params: {
          name: card.name,
          balance: card.balance,
          ticker: card.ticker,
          usdValue: card.usdValue,
          color: card.color,
          tags: JSON.stringify(card.tags || []),
          tokenCount: card.tokenCount?.toString() || '0',
          transitionId: `card-${card.name}-${index}`,
          returnPosition: JSON.stringify({
            cardIndex: index,
            originalPosition: { translateY: 0, scale: FOCUSED_SCALE },
          }),
        },
      });
    };

    cardY.value = withTiming(-savedPosition.value, {
      duration: 400,
    });
    cardScale.value = withTiming(
      ZOOM_SCALE,
      {
        duration: 400,
      },
      (finished) => {
        if (finished) runOnJS(navigatePush)();
      }
    );
  };

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    rotationX.value = withSpring(-3, {
      damping: 20,
      stiffness: 500,
    });
    rotationY.value = withSpring(3, {
      damping: 20,
      stiffness: 500,
    });
  };

  const handlePressOut = () => {
    rotationX.value = withSpring(0, {
      damping: 20,
      stiffness: 400,
    });
    rotationY.value = withSpring(0, {
      damping: 20,
      stiffness: 400,
    });
  };

  useEffect(() => {
    if (returnProgress != null) {
      const p = parseFloat(returnProgress as string);
      runOnUI(() => {
        'worklet';
        const headerTargetPosition = 100;
        const origPos = savedPosition.value;
        const deltaY = headerTargetPosition - origPos;
        cardY.value = withTiming(deltaY * (1 - p), { duration: 0 });
        cardScale.value = 1 + (FOCUSED_SCALE - 1) * (1 - p);
        rotationX.value = -15 * (1 - p);
        rotationY.value = 15 * (1 - p);
      })();
    }
  }, [returnProgress, savedPosition, cardY, cardScale, rotationX, rotationY]);

  useFocusEffect(
    useCallback(() => {
      if (wasTapped.value && isCurrentlySelected.value) {
        const headerPosition = 100;
        const returnDeltaY = savedPosition.value - headerPosition;

        cardY.value = -returnDeltaY;
        cardScale.value = 1.2;
        cardOpacity.value = 1;

        cardY.value = withTiming(0, { duration: 400 });
        cardScale.value = withTiming(FOCUSED_SCALE, { duration: 400 });
        rotationX.value = withTiming(0, { duration: 400 });
        rotationY.value = withTiming(0, { duration: 400 });

        setTimeout(() => {
          wasTapped.value = false;
          isCurrentlySelected.value = false;
        }, 400);
      }
    }, [cardScale, cardY, cardOpacity, wasTapped, isCurrentlySelected, savedPosition, rotationX, rotationY])
  );

  return (
    <Animated.View sharedTransitionTag={transitionId} style={[styles.card, { backgroundColor: card.color }, animatedStyle]}>
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={styles.touchableCard}
        activeOpacity={0.9}
        testID={card.networkId ? `network-${card.networkId}` : `card-${card.name.toLowerCase()}`}
      >
        <View style={styles.topRow}>
          <View style={styles.cardHeader}>
            {card.icon ? (
              <Image source={card.icon} style={styles.cardIcon} />
            ) : (
              <View style={[styles.cardIconPlaceholder, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Text style={{ color: 'white', fontWeight: 'bold' }}>{card.ticker.charAt(0)}</Text>
              </View>
            )}
          </View>
          <View style={styles.tagsContainer}>
            {card.tokenCount && card.tokenCount > 0 ? (
              <View style={styles.tagBadge}>
                <Text style={styles.tagText}>
                  {card.tokenCount} Token{card.tokenCount > 1 ? 's' : ''}
                </Text>
              </View>
            ) : (
              card.tags &&
              card.tags.map((tag: string, i: number) => (
                <View key={i} style={styles.tagBadge}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.bottomRow}>
          <Text style={styles.cardName}>{card.name}</Text>
          <View style={styles.cardBalanceContainer}>
            <Text style={styles.cardBalance}>
              {card.balance || '0'} {card.ticker}
            </Text>
            <Text style={styles.cardUsdValue}>{card.usdValue || '0.00'}</Text>
          </View>
        </View>
      </TouchableOpacity>
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
        name: network.charAt(0).toUpperCase() + network.slice(1),
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

const NetworkCard = ({
  card,
  index,
  cardPosition,
  scrollY,
  selectedIndex,
  onCardPress,
  transitionId,
  totalCards,
  disableNavigation,
  accountNumber,
}: LayerCardTileProps & { accountNumber: number }) => {
  const { balance, isLoading: balanceLoading, error: balanceError } = useBalance(card.networkId as any, accountNumber, BackgroundExecutor);
  const { exchangeRate, isLoading: exchangeRateLoading, error: exchangeRateError } = useExchangeRate(card.networkId as any, 'USD');
  const [hasTimedOut, setHasTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setHasTimedOut(true);
    }, 10000);

    return () => clearTimeout(timer);
  }, []);

  const cardData = useMemo(() => {
    const isTestnet = getIsTestnet(card.networkId as any);

    const formattedBalance =
      balance !== undefined && balance !== null ? formatBalance(balance, getDecimalsByNetwork(card.networkId as any), 8) : balanceLoading && !hasTimedOut ? '···' : balanceError ? 'Error' : '0.00000';

    const formattedUsdValue = isTestnet
      ? 'Testnet'
      : balance !== undefined && balance !== null && exchangeRate
        ? `$${formatFiatBalance(balance, getDecimalsByNetwork(card.networkId as any), exchangeRate)}`
        : exchangeRateLoading && !hasTimedOut
          ? '···'
          : exchangeRateError
            ? 'Rate Error'
            : '$0.00';

    return {
      ...card,
      balance: formattedBalance,
      usdValue: formattedUsdValue,
    };
  }, [card, balance, exchangeRate, balanceLoading, exchangeRateLoading, hasTimedOut, balanceError, exchangeRateError]);

  return (
    <LayerCardTile
      card={cardData}
      index={index}
      cardPosition={cardPosition}
      scrollY={scrollY}
      selectedIndex={selectedIndex}
      onCardPress={onCardPress}
      transitionId={transitionId}
      totalCards={totalCards}
      disableNavigation={disableNavigation}
    />
  );
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
  const listRef = useRef<Animated.FlatList<any>>(null);
  const scrollOffset = useSharedValue(0);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentNetworkId, setCurrentNetworkId] = useState<string>('bitcoin');
  // Initialize opacity immediately to prevent flash
  const opacity = useSharedValue(isNetworkSelector ? 1 : 0);

  useEffect(() => {
    if (isNetworkSelector) {
      // For network selector, ensure opacity stays at 1 immediately
      opacity.value = 1;
    } else {
      // For dashboard, use the fade-in animation
      opacity.value = withTiming(1, { duration: 150 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [opacity, isNetworkSelector]);

  useEffect(() => {
    if (cards.length > 0 && cards[0]?.networkId) {
      setCurrentNetworkId(cards[0].networkId);
    }
  }, [cards]);

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

  useFocusEffect(
    useCallback(() => {
      setSelectedIndex(-1);
    }, [])
  );

  const handleCardPress = useCallback(
    (index: number) => {
      if (onExternalCardPress) {
        onExternalCardPress(index);
      } else {
        setSelectedIndex(index);
      }
      const actualIndex = index % cards.length;
      const selectedCard = cards[actualIndex];
      if (selectedCard?.networkId) {
        setCurrentNetworkId(selectedCard.networkId);
      }
    },
    [onExternalCardPress, cards]
  );

  const infiniteScrollData = useMemo(() => {
    if (cards.length === 0) return [];

    // Always use infinite scroll with repetitions for smooth experience
    const repeatCount = 7;
    const result: (LayerCard & { uniqueKey: string; originalIndex: number })[] = [];

    for (let i = 0; i < repeatCount; i++) {
      cards.forEach((card, index) => {
        result.push({
          ...card,
          uniqueKey: `${i}-${index}`,
          originalIndex: index,
        });
      });
    }

    return result;
  }, [cards]);

  const initialScrollPosition = useMemo(() => {
    if (infiniteScrollData.length === 0) return 0;

    // Always start in middle of repeated data for infinite scroll
    const middleRepeat = Math.floor(7 / 2);
    return middleRepeat * cards.length;
  }, [infiniteScrollData.length, cards.length]);

  useEffect(() => {
    if (!isInitialized && infiniteScrollData.length > 0 && listRef.current) {
      const initialOffset = initialScrollPosition * SCROLL_SNAP_THRESHOLD;
      // Use requestAnimationFrame to prevent flash on first render
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: initialOffset, animated: false });
        setIsInitialized(true);
        scrollOffset.value = initialOffset;
      });
    }
  }, [infiniteScrollData.length, isInitialized, initialScrollPosition, scrollOffset, cards]);

  const handleScrollEnd = useCallback(() => {
    // Always handle infinite scroll logic for smooth experience
    const currentOffset = scrollOffset.value;
    const sectionHeight = cards.length * SCROLL_SNAP_THRESHOLD;
    const currentSection = Math.floor(currentOffset / sectionHeight);

    if (currentSection <= 0 || currentSection >= 6) {
      const relativeOffset = currentOffset % sectionHeight;
      const newOffset = sectionHeight * 3 + relativeOffset;

      setTimeout(() => {
        listRef.current?.scrollToOffset({ offset: newOffset, animated: false });
        scrollOffset.value = newOffset;
      }, 8);
    }
  }, [scrollOffset, cards.length]);

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const updateFocusedCard = useCallback(
    (actualCardIndex: number) => {
      const focusedCard = cards[actualCardIndex];
      if (focusedCard?.networkId) {
        setCurrentNetworkId(focusedCard.networkId);
      }
    },
    [cards]
  );

  useAnimatedReaction(
    () => {
      return Math.round(scrollOffset.value / SCROLL_SNAP_THRESHOLD);
    },
    (currentIndex, previousIndex) => {
      if (currentIndex !== previousIndex && currentIndex >= 0) {
        const actualCardIndex = currentIndex % cards.length;
        runOnJS(updateFocusedCard)(actualCardIndex);
        runOnJS(triggerHaptic)();
      }
    },
    [scrollOffset, cards.length]
  );

  const scrollHandler = useAnimatedScrollHandler(
    {
      onScroll: (event) => {
        scrollOffset.value = event.contentOffset.y;
      },
    },
    []
  );

  const renderCard = useCallback(
    ({ item, index }: { item: LayerCard & { uniqueKey: string; originalIndex: number }; index: number }) => {
      const cardPosition = index * SCROLL_SNAP_THRESHOLD;

      const hasPlaceholderData =
        providedCards && (item.balance === 'Selected' || item.balance === 'Available' || item.usdValue === 'Mainnet' || item.usdValue === 'Testnet' || item.balance === '0.00000');

      return (
        <View style={[styles.cardWrapper, { zIndex: 999, elevation: 50 }]}>
          {providedCards && !hasPlaceholderData ? (
            <LayerCardTile
              card={item}
              index={index}
              cardPosition={cardPosition}
              scrollY={scrollOffset}
              selectedIndex={selectedIndex}
              onCardPress={handleCardPress}
              transitionId={`card-${item.name}-${index}`}
              totalCards={infiniteScrollData.length}
              disableNavigation={!!onExternalCardPress}
              isNetworkSelector={isNetworkSelector}
            />
          ) : (
            <NetworkCard
              card={item}
              index={index}
              cardPosition={cardPosition}
              scrollY={scrollOffset}
              selectedIndex={selectedIndex}
              onCardPress={handleCardPress}
              transitionId={`card-${item.name}-${index}`}
              totalCards={infiniteScrollData.length}
              disableNavigation={!!onExternalCardPress}
              accountNumber={accountNumber}
            />
          )}
        </View>
      );
    },
    [scrollOffset, selectedIndex, handleCardPress, infiniteScrollData.length, onExternalCardPress, providedCards, accountNumber, isNetworkSelector]
  );

  return (
    <Animated.View style={[styles.container, containerAnimatedStyle]}>
      <BlurView intensity={50} tint="dark" style={styles.backgroundBlur} pointerEvents="none" />
      {onClose && (
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.networkSwitcherTrigger} testID="NetworkSwitcherTrigger" onPress={() => {}}>
        <Text style={styles.hiddenText}>Network Switcher</Text>
      </TouchableOpacity>

      <View style={styles.selectedNetworkIndicator} testID={`selectedNetwork-${currentNetworkId}`}>
        <Text style={styles.hiddenText}>{currentNetworkId} Selected</Text>
      </View>

      <Animated.FlatList
        ref={listRef}
        data={infiniteScrollData}
        renderItem={renderCard}
        keyExtractor={(item) => item.uniqueKey}
        onScroll={scrollHandler}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={4}
        showsVerticalScrollIndicator={false}
        decelerationRate={'fast'}
        pagingEnabled={false}
        bounces={true}
        removeClippedSubviews={false}
        maxToRenderPerBatch={8}
        windowSize={15}
        initialNumToRender={5} // Render fewer items initially to prevent flash
        snapToInterval={SCROLL_SNAP_THRESHOLD}
        snapToAlignment={'start'}
        getItemLayout={(data, index) => ({ length: SCROLL_SNAP_THRESHOLD, offset: SCROLL_SNAP_THRESHOLD * index, index })}
        contentContainerStyle={{
          paddingTop: height / 4 - CARD_HEIGHT / 2,
          paddingBottom: height / 4 - CARD_HEIGHT / 2,
        }}
        style={[
          styles.flatListContainer,
          {
            height: height / 2, // Standard height for infinite scroll
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            opacity: isInitialized ? 1 : 0, // Only show when initialized
          },
        ]}
      />
    </Animated.View>
  );
};

export default DashboardTiles;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'visible',
  },
  flatListContainer: {
    paddingHorizontal: 16,
    overflow: 'visible',
  },
  cardWrapper: {
    height: SCROLL_SNAP_THRESHOLD,
    width: CARD_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
    zIndex: 1,
  },
  card: {
    height: CARD_HEIGHT,
    width: CARD_WIDTH,
    backgroundColor: '#001689',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    position: 'absolute',
  },
  touchableCard: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIcon: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  cardIconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardName: {
    color: 'white',
    fontSize: 18,
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
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  cardUsdValue: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    marginTop: 2,
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginLeft: 6,
    marginTop: 6,
  },
  tagText: {
    color: 'white',
    fontSize: 12,
  },
  backgroundBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  blurCard: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1000,
    padding: 10,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  networkSwitcherTrigger: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    opacity: 0,
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
});
