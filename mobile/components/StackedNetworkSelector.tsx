import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Text, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, interpolate, useAnimatedScrollHandler, runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { Networks } from '@shared/types/networks';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width - 32;
const CARD_HEIGHT = 200;
const STACK_OFFSET = 2; // Very tight stacking
const ITEM_HEIGHT = 40; // Very small item height for tight stacking
const VISIBLE_CARD_OFFSET_TOP = 45; // How much of cards above are visible (logo area only)
const VISIBLE_CARD_OFFSET_BOTTOM = 60; // How much of cards below are visible (name/balance area only)

export interface NetworkCard {
  name: string;
  ticker: string;
  balance: string;
  usdValue: string;
  color: string;
  iconName?: string;
  tags?: string[];
  networkId: Networks;
  isSelected: boolean;
}

interface StackedCardProps {
  card: NetworkCard;
  index: number;
  scrollY: Animated.SharedValue<number>;
  onPress: () => void;
  totalCards: number;
}

const StackedCard: React.FC<StackedCardProps> = ({ card, index, scrollY, onPress, totalCards }) => {
  const cardOffset = index * ITEM_HEIGHT;

  const animatedStyle = useAnimatedStyle(() => {
    const centerY = height / 2 - CARD_HEIGHT / 2;
    const currentCardY = cardOffset - scrollY.value + centerY;
    const relativePosition = (currentCardY - centerY) / ITEM_HEIGHT;

    // Determine if this card is above, at, or below center
    const isAtCenter = Math.abs(relativePosition) < 0.5;
    const isAboveCenter = relativePosition < -0.5;
    const isBelowCenter = relativePosition > 0.5;

    let stackOffsetY = 0;
    let scale = 1.0;
    let opacity = 1.0;

    if (isAtCenter) {
      // This is the centered/focused card - no offset, full scale
      stackOffsetY = 0;
      scale = 1.0;
      opacity = 1.0;
    } else if (isAboveCenter) {
      // Cards above: stack them very tightly showing only bottom portion (logo area)
      const cardIndex = Math.abs(Math.floor(relativePosition));
      stackOffsetY = -VISIBLE_CARD_OFFSET_TOP * cardIndex;
      scale = interpolate(cardIndex, [1, 3], [0.98, 0.94], 'clamp');
      opacity = interpolate(cardIndex, [1, 4], [0.95, 0.7], 'clamp');
    } else if (isBelowCenter) {
      // Cards below: stack them tightly showing only top portion (name/balance area)
      const cardIndex = Math.floor(relativePosition);
      stackOffsetY = VISIBLE_CARD_OFFSET_BOTTOM * cardIndex;
      scale = interpolate(cardIndex, [1, 3], [0.98, 0.94], 'clamp');
      opacity = interpolate(cardIndex, [1, 4], [0.95, 0.7], 'clamp');
    }

    // Z-index for proper layering
    const zIndex = Math.round(100 - Math.abs(relativePosition) * 10);

    return {
      transform: [{ translateY: stackOffsetY }, { scale }],
      opacity,
      zIndex: Math.max(1, zIndex),
      elevation: Math.max(1, zIndex),
    };
  });

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  }, [onPress]);

  return (
    <Animated.View style={[styles.cardContainer, animatedStyle]}>
      <TouchableOpacity onPress={handlePress} style={[styles.card, { backgroundColor: card.color }]} activeOpacity={0.9} testID={`network-${card.networkId}`}>
        <View style={styles.topRow}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconPlaceholder, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Text style={styles.cardIconText}>{card.ticker.charAt(0)}</Text>
            </View>
          </View>
          <View style={styles.tagsContainer}>
            {card.isSelected && (
              <View style={styles.selectedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="white" />
                <Text style={styles.selectedText}>Selected</Text>
              </View>
            )}
            {card.tags?.map((tag: string, i: number) => (
              <View key={i} style={styles.tagBadge}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.bottomRow}>
          <Text style={styles.cardName}>{card.name}</Text>
          <View style={styles.cardBalanceContainer}>
            <Text style={styles.cardBalance}>{card.balance}</Text>
            <Text style={styles.cardUsdValue}>{card.usdValue}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

interface StackedNetworkSelectorProps {
  cards: NetworkCard[];
  onCardPress: (index: number) => void;
  onClose?: () => void;
}

const StackedNetworkSelector: React.FC<StackedNetworkSelectorProps> = ({ cards, onCardPress, onClose }) => {
  const scrollY = useSharedValue(0);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const flatListRef = useRef<Animated.FlatList<any>>(null);

  // Find the initially selected card and center on it
  const selectedIndex = useMemo(() => {
    return cards.findIndex((card) => card.isSelected);
  }, [cards]);

  // Set initial focused index to selected card
  useEffect(() => {
    if (selectedIndex >= 0) {
      setFocusedIndex(selectedIndex);
    }
  }, [selectedIndex]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const updateFocusedCard = useCallback((index: number) => {
    setFocusedIndex(index);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleMomentumScrollEnd = useCallback(
    (event: any) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const index = Math.round(offsetY / ITEM_HEIGHT);
      const clampedIndex = Math.max(0, Math.min(index, cards.length - 1));

      // Snap to the exact position
      const targetOffset = clampedIndex * ITEM_HEIGHT;
      flatListRef.current?.scrollToOffset({ offset: targetOffset, animated: true });

      updateFocusedCard(clampedIndex);
    },
    [cards.length, updateFocusedCard]
  );

  // Handle scroll end for smoother snapping
  const handleScrollEndDrag = useCallback(
    (event: any) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const index = Math.round(offsetY / ITEM_HEIGHT);
      const clampedIndex = Math.max(0, Math.min(index, cards.length - 1));

      // Immediately snap to position
      const targetOffset = clampedIndex * ITEM_HEIGHT;
      flatListRef.current?.scrollToOffset({ offset: targetOffset, animated: true });

      updateFocusedCard(clampedIndex);
    },
    [cards.length, updateFocusedCard]
  );

  const renderCard = useCallback(
    ({ item, index }: { item: NetworkCard; index: number }) => {
      return <StackedCard card={item} index={index} scrollY={scrollY} onPress={() => onCardPress(index)} totalCards={cards.length} />;
    },
    [scrollY, onCardPress, cards.length]
  );

  const getItemLayout = useCallback(
    (data: any, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  return (
    <View style={styles.container}>
      <BlurView intensity={80} tint="dark" style={styles.backgroundBlur} />

      {onClose && (
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={28} color="white" />
        </TouchableOpacity>
      )}

      <View style={styles.listContainer}>
        <Animated.FlatList
          data={cards}
          renderItem={renderCard}
          keyExtractor={(item, index) => `${item.networkId}-${index}`}
          onScroll={scrollHandler}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={ITEM_HEIGHT}
          snapToAlignment="start"
          getItemLayout={getItemLayout}
          initialScrollIndex={selectedIndex > 0 ? selectedIndex : 0}
          contentContainerStyle={{
            paddingTop: height / 2 - CARD_HEIGHT / 2,
            paddingBottom: height / 2 - CARD_HEIGHT / 2,
          }}
          style={styles.flatList}
          removeClippedSubviews={false} // Keep all cards rendered for smooth stacking
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  backgroundBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1000,
    padding: 12,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
    overflow: 'visible', // Allow stacking effect to be visible
  },
  flatList: {
    flex: 1,
    overflow: 'visible', // Allow cards to stack outside bounds
  },
  cardContainer: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible', // Allow cards to overlap
  },
  card: {
    height: CARD_HEIGHT,
    width: CARD_WIDTH,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 'auto',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIconText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
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
  },
  cardBalance: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
  },
  cardUsdValue: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'right',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },
  selectedBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  tagBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 6,
    marginTop: 4,
  },
  tagText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '500',
  },
});

export default StackedNetworkSelector;
