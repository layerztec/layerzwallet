import React, { useContext, useEffect, useMemo, useState, forwardRef, useImperativeHandle, useRef } from 'react';
import { BackHandler, Dimensions, Linking, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, withRepeat, withSequence } from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import { MaterialIcons } from '@expo/vector-icons';
import Timeline from 'react-native-timeline-flatlist';
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop, BottomSheetBackdropProps, TouchableOpacity as BottomSheetTouchableOpacity, BottomSheetBackgroundProps } from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { getNetworkImageAsset } from '@/utils/networkAssets';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useExchangeRate } from '@shared/hooks/useExchangeRate';
import { getDecimalsByNetwork, getIsEVM, getTickerByNetwork } from '@shared/models/network-getters';
import { getTokenInfo, getTokenIconColor } from '@shared/models/token-list';
import { capitalizeFirstLetter, formatBalance, formatFiatBalance } from '@shared/modules/string-utils';
import { CommonTransaction } from '@shared/types/common-transaction';
import { NETWORK_ARK, NETWORK_ARK_MUTINYNET, NETWORK_BITCOIN, NETWORK_LIGHTNING, NETWORK_LIGHTNING_TESTNET, NETWORK_SPARK } from '@shared/types/networks';
import * as BlueElectrum from '@shared/blue_modules/BlueElectrum';
import { gradients } from '@shared/constants/Colors';

interface TransactionDetailsProps {
  transaction: CommonTransaction;
  onDismiss: () => void;
}

const TransactionDetails = forwardRef<BottomSheetModal, TransactionDetailsProps>(({ transaction, onDismiss }, ref) => {
  const { network: selectedNetwork } = useContext(NetworkContext);
  const network = transaction.network;
  const ticker = getTickerByNetwork(network);
  const decimals = getDecimalsByNetwork(network);
  const { exchangeRate } = useExchangeRate(network, 'USD');
  const networkImage = getNetworkImageAsset(network);
  const networkIconContent = networkImage ? <Image source={networkImage} style={styles.networkImage} contentFit="contain" /> : null;
  const [imageLoadErrors, setImageLoadErrors] = useState<{ [key: string]: boolean }>({});
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(false);
  const [confirmationEta, setConfirmationEta] = useState<string>('');

  // Get gradient colors for the network
  const getGradientColors = () => {
    let id: keyof typeof gradients = 'base';
    for (const key of Object.keys(gradients)) {
      if (key.startsWith(selectedNetwork)) {
        id = key as keyof typeof gradients;
        break;
      }
    }
    return gradients[id];
  };

  const gradientColors = getGradientColors();
  const insets = useSafeAreaInsets();

  // Custom background component with gradient
  const renderBackground = useMemo(() => {
    const CustomBackground: React.FC<BottomSheetBackgroundProps> = ({ style }) => {
      return (
        <View style={[style, { overflow: 'hidden' as const }]} pointerEvents="none">
          <LinearGradient colors={gradientColors} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none" />
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
            }}
            pointerEvents="none"
          />
        </View>
      );
    };
    return CustomBackground;
  }, [gradientColors]);

  // Get screen height for maxDynamicContentSize
  const screenHeight = useMemo(() => Dimensions.get('window').height, []);

  // Create internal ref for BottomSheetModal
  const bottomSheetRef = useRef<BottomSheetModal>(null);

  // Expose ref methods to parent
  useImperativeHandle(ref, () => bottomSheetRef.current as BottomSheetModal);

  // Handle back button on Android
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (bottomSheetRef.current) {
        bottomSheetRef.current.dismiss();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, []);

  // Animation values
  const descriptionOpacity = useSharedValue(0);
  const timestampOpacity = useSharedValue(0);
  const descriptionMaxHeight = useSharedValue(0);
  const pendingFlashOpacity = useSharedValue(1);

  // Animated styles
  const descriptionAnimatedStyle = useAnimatedStyle(() => ({
    opacity: descriptionOpacity.value,
    maxHeight: descriptionMaxHeight.value,
    overflow: 'hidden',
  }));

  const timestampAnimatedStyle = useAnimatedStyle(() => ({
    opacity: timestampOpacity.value,
  }));

  const pendingFlashAnimatedStyle = useAnimatedStyle(() => ({
    opacity: pendingFlashOpacity.value,
  }));

  // Check if transaction is currently pending (for flashing animation)
  const hasConfirmations = (transaction.confirmations ?? 0) > 0;
  const isCurrentlyPending = transaction.status === 'pending' && !hasConfirmations;

  // Flashing animation for pending state
  useEffect(() => {
    if (isCurrentlyPending) {
      // Start flashing animation
      pendingFlashOpacity.value = withRepeat(
        withSequence(withTiming(0.4, { duration: 800 }), withTiming(1, { duration: 800 })),
        -1, // Infinite repeat
        false
      );
    } else {
      // Stop flashing, set to full opacity
      pendingFlashOpacity.value = withTiming(1, { duration: 300 });
    }
  }, [isCurrentlyPending, pendingFlashOpacity]);

  // Sync animations with state
  useEffect(() => {
    if (isTimelineExpanded) {
      // Expand
      descriptionOpacity.value = withTiming(1, { duration: 300 });
      timestampOpacity.value = withTiming(1, { duration: 300 });
      descriptionMaxHeight.value = withTiming(100, { duration: 300 });
    } else {
      // Collapse
      descriptionOpacity.value = withTiming(0, { duration: 300 });
      timestampOpacity.value = withTiming(0, { duration: 300 });
      descriptionMaxHeight.value = withTiming(0, { duration: 300 });
    }
  }, [isTimelineExpanded, descriptionOpacity, timestampOpacity, descriptionMaxHeight]);

  // Toggle timeline expansion
  const toggleTimeline = () => {
    setIsTimelineExpanded(!isTimelineExpanded);
  };

  // Calculate ETA for Bitcoin pending transactions
  useEffect(() => {
    let isMounted = true;

    const calculateConfirmationEta = async () => {
      // Only calculate for Bitcoin networks and pending transactions
      const isBitcoin = network === NETWORK_BITCOIN;
      const hasConfirmations = (transaction.confirmations ?? 0) > 0;
      const isPending = transaction.status === 'pending' && !hasConfirmations;

      if (!isBitcoin || !isPending || !transaction.txid) {
        setConfirmationEta('');
        return;
      }

      try {
        // Check if Electrum is connected
        if (!BlueElectrum.mainConnected) {
          await BlueElectrum.waitTillConnected();
        }

        // Get transaction details from Electrum to get vsize and calculate fee
        const transactions = await BlueElectrum.multiGetTransactionByTxid([transaction.txid], true, 10);
        const txFromElectrum = transactions[transaction.txid];

        if (!txFromElectrum || !txFromElectrum.vsize) {
          if (isMounted) {
            setConfirmationEta('');
          }
          return;
        }

        // First, we need to fetch previous transactions to get input values
        let totalInputValue = 0;
        let totalOutputValue = 0;

        // Sum all input values - need to fetch previous transactions if values are missing
        if (txFromElectrum.vin && Array.isArray(txFromElectrum.vin)) {
          // Collect unique previous transaction IDs
          const prevTxids = new Set<string>();
          for (const input of txFromElectrum.vin) {
            if (input.txid) {
              prevTxids.add(input.txid);
            }
          }

          // Fetch previous transactions if input values are missing
          if (prevTxids.size > 0 && !txFromElectrum.vin[0]?.value) {
            try {
              const prevTransactions = await BlueElectrum.multiGetTransactionByTxid(Array.from(prevTxids), true, 10);

              // Populate input values from previous transactions
              for (const input of txFromElectrum.vin) {
                if (input.txid && input.vout !== undefined) {
                  const prevTx = prevTransactions[input.txid];
                  if (prevTx && prevTx.vout && prevTx.vout[input.vout]) {
                    const prevOutput = prevTx.vout[input.vout];
                    if (prevOutput.value !== undefined && prevOutput.value !== null) {
                      input.value = prevOutput.value;
                      totalInputValue += prevOutput.value;
                    }
                  }
                }
              }
            } catch (error) {
              console.error('Error fetching previous transactions for ETA:', error);
            }
          } else {
            // Input values already populated
            for (const input of txFromElectrum.vin) {
              if (input.value !== undefined && input.value !== null) {
                totalInputValue += input.value;
              }
            }
          }
        }

        // Sum all output values
        if (txFromElectrum.vout && Array.isArray(txFromElectrum.vout)) {
          for (const output of txFromElectrum.vout) {
            if (output.value !== undefined && output.value !== null) {
              totalOutputValue += output.value;
            }
          }
        }

        // Calculate fee in BTC
        const feeBtc = totalInputValue - totalOutputValue;

        if (feeBtc <= 0 || totalInputValue === 0) {
          if (isMounted) {
            setConfirmationEta('');
          }
          return;
        }

        // Calculate fee rate (sat/vbyte)
        const feeSat = Math.round(feeBtc * 100000000); // Convert to satoshis
        const feeRate = feeSat / txFromElectrum.vsize;

        // Get mempool fee histogram
        const histogram = await (BlueElectrum as any).getMempoolFeeHistogram();

        if (!histogram || histogram.length === 0) {
          if (isMounted) {
            setConfirmationEta('');
          }
          return;
        }

        // Calculate how many blocks of transactions are ahead with higher fees
        let totalVsizeAhead = 0;
        const blockSize = 1000000;

        for (const entry of histogram) {
          const [fee, vsize] = entry;
          if (fee > feeRate) {
            totalVsizeAhead += vsize;
          } else {
            break;
          }
        }

        // Calculate blocks ahead (rounded up)
        const blocksAhead = Math.ceil(totalVsizeAhead / blockSize);

        // Estimate time: blocks ahead * 10 minutes per block
        const avgBlockTimeMinutes = 10;
        const estimatedMinutes = blocksAhead * avgBlockTimeMinutes;

        // Format ETA
        let etaText = '';
        if (estimatedMinutes < 1) {
          etaText = '< 1 min';
        } else if (estimatedMinutes < 60) {
          etaText = `~${Math.round(estimatedMinutes)} min`;
        } else {
          const hours = Math.floor(estimatedMinutes / 60);
          const minutes = Math.round(estimatedMinutes % 60);
          if (minutes === 0) {
            etaText = `~${hours} ${hours === 1 ? 'hour' : 'hours'}`;
          } else {
            etaText = `~${hours}h ${minutes}m`;
          }
        }

        if (isMounted) {
          setConfirmationEta(etaText);
        }
      } catch (error) {
        console.error('Error calculating confirmation ETA:', error);
        if (isMounted) {
          setConfirmationEta('');
        }
      }
    };

    calculateConfirmationEta();

    return () => {
      isMounted = false;
    };
  }, [transaction.txid, transaction.status, transaction.confirmations, network]);

  // Check if this is a zero-amount transaction with tokens
  const isZeroAmountWithTokens = useMemo(() => {
    return !transaction.amount && transaction.tokenTransfers && transaction.tokenTransfers.length > 0;
  }, [transaction.amount, transaction.tokenTransfers]);

  const singleTokenInfo = useMemo(() => {
    if (isZeroAmountWithTokens && transaction.tokenTransfers?.length === 1) {
      return getTokenInfo(transaction.tokenTransfers[0].tokenId);
    }
    return null;
  }, [isZeroAmountWithTokens, transaction.tokenTransfers]);

  const [formattedDate, formattedDateWithTime] = useMemo(() => {
    const d = new Date(transaction.timestamp * 1000);
    const dateStr = d.toLocaleDateString('en-US', {
      month: 'long',
      day: '2-digit',
      year: 'numeric',
    });
    const timeStr = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return [dateStr, `${dateStr} - ${timeStr.toLowerCase()}`];
  }, [transaction.timestamp]);

  const amountPrimary = useMemo(() => {
    if (isZeroAmountWithTokens && singleTokenInfo) {
      const transfer = transaction.tokenTransfers?.[0];
      if (transfer) {
        const isNegative = transaction.direction === 'send';
        const sign = isNegative ? '-' : '';
        const formattedAmount = transfer.amount ? formatBalance(transfer.amount.toString(), singleTokenInfo.decimals) : '0';
        return `${sign}${formattedAmount}`;
      }
    }

    if (transaction.amount === undefined) return '';
    return formatBalance(Math.abs(transaction.amount).toString(), decimals);
  }, [isZeroAmountWithTokens, singleTokenInfo, transaction.tokenTransfers, transaction.direction, transaction.amount, decimals]);

  const amountTicker = useMemo(() => {
    if (isZeroAmountWithTokens && singleTokenInfo) {
      return singleTokenInfo.symbol;
    }
    return ticker;
  }, [isZeroAmountWithTokens, singleTokenInfo, ticker]);

  const amountUsd = useMemo(() => {
    if (isZeroAmountWithTokens) {
      return '';
    }

    if (transaction.amount === undefined || !exchangeRate) return '— USD';
    return `${formatFiatBalance(Math.abs(transaction.amount).toString(), decimals, exchangeRate)} USD`;
  }, [isZeroAmountWithTokens, transaction.amount, decimals, exchangeRate]);

  const statusText = useMemo(() => {
    switch (transaction.status) {
      case 'pending':
        return 'Pending...';
      case 'confirmed':
        return 'Confirmed';
      case 'failed':
        return 'Failed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return undefined;
    }
  }, [transaction.status]);

  const directionText = useMemo(() => {
    if (isZeroAmountWithTokens && singleTokenInfo) {
      switch (transaction.direction) {
        case 'send':
          return `Sent ${singleTokenInfo.name}`;
        case 'receive':
          return `Received ${singleTokenInfo.name}`;
        case 'swap':
          return `Swapped ${singleTokenInfo.name}`;
        default:
          return singleTokenInfo.name;
      }
    }

    if (transaction.direction === 'send') return 'Sent';
    if (transaction.direction === 'receive') return 'Received';
    if (transaction.direction === 'swap') return 'Swap';
    return 'Transaction';
  }, [isZeroAmountWithTokens, singleTokenInfo, transaction.direction]);

  // Calculate block time from block height
  // Used for displaying confirmed timestamps in the timeline for all networks
  const calculateBlockTime = useMemo(() => {
    if (!transaction.blockHeight) return null;

    const blockHeight = transaction.blockHeight;
    const isEVM = getIsEVM(transaction.network);

    // EVM chains (Ethereum, etc.) have ~12 second block times
    // Bitcoin-based chains have ~10 minute (600 seconds) block times
    const avgBlockTimeSeconds = isEVM ? 12 : 600;

    // Estimate: current time - (blocks since confirmation * avg block time)
    // This is a rough estimate, but better than nothing
    const currentTime = Math.floor(Date.now() / 1000);
    const confirmations = transaction.confirmations ?? 0;
    const estimatedBlockTime = currentTime - confirmations * avgBlockTimeSeconds;

    return estimatedBlockTime;
  }, [transaction.blockHeight, transaction.confirmations, transaction.network]);

  // Generate timeline data
  const timelineData = useMemo(() => {
    const isLightning = network === NETWORK_LIGHTNING || network === NETWORK_LIGHTNING_TESTNET || network === NETWORK_ARK || network === NETWORK_ARK_MUTINYNET || network === NETWORK_SPARK;

    const hasConfirmations = (transaction.confirmations ?? 0) > 0;
    const isPending = transaction.status === 'pending' && !hasConfirmations;
    const isConfirmed = transaction.status === 'confirmed' || hasConfirmations;
    const isFailed = transaction.status === 'failed';
    const isCancelled = transaction.status === 'cancelled';

    const formatTime = (ts: number) => {
      const d = new Date(ts * 1000);
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    };

    const getDirectionTitle = () => {
      switch (transaction.direction) {
        case 'send':
          return 'Sent';
        case 'receive':
          return 'Received';
        case 'swap':
          return 'Swap';
        default:
          return 'Transaction';
      }
    };

    const timeline: {
      time: string;
      title: string;
      description: string;
      lineColor: string;
      circleColor: string;
      completed: boolean;
      icon?: React.ReactElement;
    }[] = [];

    // STATE 1: SENT/RECEIVED/SWAP (always completed, always white)
    // Show timestamp only if transaction is pending (not confirmed)
    const sentLineColor = '#FFFFFF';
    timeline.push({
      time: isPending ? formatTime(transaction.timestamp) : '',
      title: getDirectionTitle(),
      description: isLightning ? 'Payment initiated' : 'Transaction broadcasted',
      completed: true,
      lineColor: sentLineColor,
      circleColor: '#FFFFFF',
      icon: <MaterialIcons name="check" size={12} color="#000000" />,
    });

    // STATE 2: PENDING (for all networks, including Lightning)
    const isCurrentlyPending = isPending;
    const pendingTimestamp = isCurrentlyPending ? Math.floor(Date.now() / 1000) : transaction.timestamp;

    // If confirmed, pending is also completed (already achieved)
    // If currently pending, it's active (completed)
    // Otherwise, it's not yet reached (gray)
    const pendingCompleted = isConfirmed || isCurrentlyPending;

    // Line color from Pending to Confirmed: white only if Confirmed is reached, gray otherwise
    // The lineColor property controls the line AFTER this item
    const pendingLineColor = isConfirmed ? '#FFFFFF' : 'rgba(255, 255, 255, 0.3)';

    // Show timestamp only if transaction is pending (not confirmed)
    timeline.push({
      time: isPending ? formatTime(pendingTimestamp) : '',
      title: 'Pending',
      description: isLightning ? 'Payment processing' : 'Waiting for confirmations',
      completed: pendingCompleted, // true = white (completed/active), false = gray (not yet reached)
      lineColor: pendingLineColor, // Controls line from Pending to Confirmed
      circleColor: pendingCompleted ? '#FFFFFF' : 'rgba(255, 255, 255, 0.3)',
      icon: <MaterialIcons name="check" size={12} color={pendingCompleted ? '#000000' : 'rgba(255, 255, 255, 0.3)'} />,
    });

    // STATE 3: CONFIRMED
    // Show timestamp if confirmed, or ETA if pending (Bitcoin only)
    const confirmedTimestamp = calculateBlockTime || transaction.timestamp;
    const confirmedLineColor = isConfirmed ? '#FFFFFF' : 'rgba(255, 255, 255, 0.3)';
    // For confirmed: show timestamp, for pending: show ETA (will be displayed separately, not in time field)
    const confirmedTime = isConfirmed ? formatTime(confirmedTimestamp) : '';

    timeline.push({
      time: confirmedTime,
      title: 'Confirmed',
      description: isLightning ? 'Transaction is confirmed' : 'Transaction is confirmed',
      completed: isConfirmed,
      lineColor: confirmedLineColor,
      circleColor: isConfirmed ? '#FFFFFF' : 'rgba(255, 255, 255, 0.3)',
      icon: <MaterialIcons name="check" size={12} color={isConfirmed ? '#000000' : 'rgba(255, 255, 255, 0.3)'} />,
    });

    // Handle failed/cancelled states (replace confirmed if failed/cancelled)
    if (isFailed || isCancelled) {
      timeline.pop(); // Remove confirmed state
      timeline.push({
        time: formatTime(transaction.timestamp),
        title: isFailed ? 'Transaction Failed' : 'Transaction Cancelled',
        description: isFailed ? 'The transaction could not be completed' : 'The transaction was cancelled',
        completed: true,
        lineColor: '#FFFFFF',
        circleColor: '#FFFFFF',
        icon: <MaterialIcons name="check" size={12} color="#000000" />,
      });
    }

    return timeline;
  }, [transaction, network, calculateBlockTime]);

  const handleCopy = async (text?: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
  };

  const handleOpenInExplorer = () => {
    const url = transaction.explorerUrl;
    if (url) Linking.openURL(url);
  };

  const tokenTransfersList = useMemo(() => {
    if (!isZeroAmountWithTokens || !transaction.tokenTransfers || transaction.tokenTransfers.length <= 1) {
      return null;
    }

    return (
      <View style={styles.tokenTransfersBlock}>
        {transaction.tokenTransfers.map((transfer, index) => {
          const tokenInfo = getTokenInfo(transfer.tokenId);
          const iconColor = getTokenIconColor(tokenInfo.name);
          const formattedAmount = transfer.amount ? formatBalance(transfer.amount.toString(), tokenInfo.decimals) : '0';
          const isNegative = transaction.direction === 'send';
          const sign = isNegative ? '-' : '';
          const imageErrorKey = `${transfer.tokenId}-${index}`;
          const hasImageError = imageLoadErrors[imageErrorKey];

          const getTokenTransactionText = () => {
            switch (transaction.direction) {
              case 'send':
                return `Sent ${tokenInfo.name}`;
              case 'receive':
                return `Received ${tokenInfo.name}`;
              case 'swap':
                return `Swapped ${tokenInfo.name}`;
              default:
                return tokenInfo.name;
            }
          };

          return (
            <View key={index} style={styles.tokenTransferRow}>
              <View style={styles.tokenIconContainer}>
                {tokenInfo.logoURI && !hasImageError ? (
                  <Image source={{ uri: tokenInfo.logoURI }} style={styles.tokenLogo} contentFit="contain" onError={() => setImageLoadErrors((prev) => ({ ...prev, [imageErrorKey]: true }))} />
                ) : (
                  <View style={[styles.tokenIcon, { backgroundColor: iconColor }]}>
                    <ThemedText style={styles.tokenIconText}>{tokenInfo.symbol?.charAt(0).toUpperCase() || '?'}</ThemedText>
                  </View>
                )}
              </View>
              <View style={styles.tokenTransferDetails}>
                <ThemedText style={styles.tokenName}>{getTokenTransactionText()}</ThemedText>
              </View>
              <View style={styles.tokenAmountContainer}>
                <ThemedText style={styles.tokenAmount}>
                  {sign}
                  {tokenInfo.symbol}
                  {formattedAmount}
                </ThemedText>
              </View>
            </View>
          );
        })}
      </View>
    );
  }, [isZeroAmountWithTokens, transaction.tokenTransfers, transaction.direction, imageLoadErrors]);

  // Render backdrop
  const renderBackdrop = (props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />;

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      index={0}
      onDismiss={onDismiss}
      enablePanDownToClose={true}
      enableDynamicSizing={true}
      detached={true}
      bottomInset={insets.bottom + 8}
      maxDynamicContentSize={screenHeight * 0.95}
      backdropComponent={renderBackdrop}
      backgroundComponent={renderBackground}
      handleIndicatorStyle={styles.handleIndicator}
      style={styles.sheetContainer}
      android_keyboardInputMode="adjustResize"
    >
      <BottomSheetView key={`content-${isTimelineExpanded}`}>
        <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
          <View style={styles.container}>
            {/* Top header: icon, type, date */}
            <View style={styles.topHeader}>
              <View style={styles.networkIcon}>{networkIconContent}</View>
              <View style={styles.typeTextWrap}>
                <ThemedText style={styles.typeText}>{directionText}</ThemedText>
                {formattedDateWithTime && <ThemedText style={styles.subText}>{formattedDateWithTime}</ThemedText>}
              </View>
            </View>

            {/* Amounts */}
            <View style={styles.amountsBlock}>
              <ThemedText type={'sfProRounded' as any} style={styles.amountPrimary} textAlign="center">
                {amountPrimary}
                <ThemedText style={styles.amountTicker}> {amountTicker}</ThemedText>
              </ThemedText>
              {amountUsd && <ThemedText style={styles.amountUsd}>{amountUsd}</ThemedText>}
            </View>

            {/* Token transfers list for multiple tokens */}
            {tokenTransfersList}

            {/* Transaction Timeline */}
            {timelineData && timelineData.length > 0 && (
              <BottomSheetTouchableOpacity style={styles.timelineContainer} onPress={toggleTimeline} activeOpacity={0.9}>
                <View style={styles.timelineInnerContainer}>
                  <Timeline
                    key={`timeline-${confirmationEta}`}
                    data={timelineData}
                    circleSize={20}
                    circleColor="#FFFFFF"
                    lineColor="#FFFFFF"
                    columnFormat="single-column-left"
                    innerCircle="icon"
                    lineWidth={4}
                    timeContainerStyle={{ width: 0, minWidth: 0 }}
                    timeStyle={styles.timelineTime}
                    titleStyle={styles.timelineTitle}
                    descriptionStyle={styles.timelineDescription}
                    listViewStyle={styles.timelineListView}
                    isUsingFlatlist={true}
                    eventContainerStyle={styles.timelineEventContainer}
                    rowContainerStyle={styles.timelineRowContainer}
                    iconStyle={styles.timelineIconStyle}
                    renderTime={() => {
                      // Hide the default time container - we'll render it in renderDetail instead
                      return null;
                    }}
                    renderDetail={(rowData: any, rowDataIndex?: number) => {
                      const isCompleted = rowData?.completed !== false;
                      const isPendingTitle = rowData?.title === 'Pending';
                      const shouldFlash = isPendingTitle && isCurrentlyPending;
                      // Check if this is the last item by comparing with the last item in timelineData
                      const isLastItem = timelineData.length > 0 && (rowDataIndex === timelineData.length - 1 || rowData === timelineData[timelineData.length - 1]);
                      // Check if transaction is pending (for ETA display)
                      const hasConfirmations = (transaction.confirmations ?? 0) > 0;
                      const isPending = transaction.status === 'pending' && !hasConfirmations;

                      return (
                        <View style={[styles.timelineDetailContainer, isLastItem && styles.timelineDetailContainerLast]}>
                          <View style={styles.timelineTitleRow}>
                            {shouldFlash ? (
                              <Animated.Text
                                style={[
                                  styles.timelineTitle,
                                  pendingFlashAnimatedStyle,
                                  {
                                    color: 'rgba(255, 255, 255, 1.0)',
                                  },
                                ]}
                              >
                                {rowData?.title}
                              </Animated.Text>
                            ) : (
                              <ThemedText
                                style={[
                                  styles.timelineTitle,
                                  {
                                    color: isCompleted ? 'rgba(255, 255, 255, 1.0)' : 'rgba(255, 255, 255, 0.3)',
                                  },
                                ]}
                              >
                                {rowData?.title}
                              </ThemedText>
                            )}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
                              {/* Show ETA for Confirmed state when pending - always visible (not animated) */}
                              {(() => {
                                const shouldShowEta = rowData?.title === 'Confirmed' && isPending && confirmationEta;
                                return shouldShowEta ? (
                                  <ThemedText
                                    style={[
                                      styles.timelineTime,
                                      {
                                        color: 'rgba(255, 255, 255, 0.6)',
                                        opacity: 1, // Always visible, not affected by animation
                                      },
                                    ]}
                                  >
                                    {confirmationEta}
                                  </ThemedText>
                                ) : (
                                  rowData?.time && (
                                    <Animated.View style={timestampAnimatedStyle}>
                                      <ThemedText
                                        style={[
                                          styles.timelineTime,
                                          {
                                            color: isCompleted ? 'rgba(255, 255, 255, 1.0)' : 'rgba(255, 255, 255, 0.3)',
                                          },
                                        ]}
                                      >
                                        {rowData.time}
                                      </ThemedText>
                                    </Animated.View>
                                  )
                                );
                              })()}
                            </View>
                          </View>
                          <Animated.View style={descriptionAnimatedStyle}>
                            <ThemedText
                              style={[
                                styles.timelineDescription,
                                {
                                  color: isCompleted ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.3)',
                                },
                              ]}
                            >
                              {rowData?.description}
                            </ThemedText>
                          </Animated.View>
                        </View>
                      );
                    }}
                  />
                </View>
              </BottomSheetTouchableOpacity>
            )}

            {/* Details list */}
            <View style={styles.detailsList}>
              <View style={styles.detailRow}>
                <ThemedText style={styles.detailLabel}>{transaction.direction === 'send' ? 'To' : 'From'}</ThemedText>
                <View style={styles.detailValueWrap}>
                  <BottomSheetTouchableOpacity onPress={() => handleCopy(transaction.counterparty ?? '')}>
                    <MaterialIcons name="content-copy" size={16} color="rgba(255, 255, 255, 0.8)" />
                  </BottomSheetTouchableOpacity>
                  <ThemedText style={[styles.detailValue]} numberOfLines={1} ellipsizeMode="middle">
                    {transaction.counterparty ?? '—'}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.detailRow}>
                <ThemedText style={styles.detailLabel}>Network Fee</ThemedText>
                <ThemedText style={styles.detailValue}>{typeof transaction.fee === 'number' ? `${formatBalance(transaction.fee.toString(), decimals)} ${ticker}` : '—'}</ThemedText>
              </View>

              <View style={styles.detailRow}>
                <ThemedText style={styles.detailLabel}>Layer</ThemedText>
                <ThemedText style={styles.detailValue}>{capitalizeFirstLetter(network)}</ThemedText>
              </View>
            </View>

            {/* Open in explorer */}
            <BottomSheetTouchableOpacity disabled={!transaction.explorerUrl} style={[styles.explorerButton, !transaction.explorerUrl && { opacity: 0.6 }]} onPress={handleOpenInExplorer}>
              <ThemedText style={styles.explorerText}>Open in explorer</ThemedText>
            </BottomSheetTouchableOpacity>
          </View>
        </SafeAreaView>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

TransactionDetails.displayName = 'TransactionDetails';

export default TransactionDetails;

const styles = StyleSheet.create({
  sheetContainer: {
    marginHorizontal: 12,
    borderRadius: 20,
    overflow: 'hidden',
  },
  safeArea: {
    backgroundColor: 'transparent',
  },
  handleIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  container: {
    marginHorizontal: 16,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  networkIcon: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  networkImage: {
    width: 24,
    height: 24,
  },
  typeTextWrap: {
    marginLeft: 12,
  },
  typeText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  subText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: -2,
  },
  amountsBlock: {
    marginVertical: 32,
    alignItems: 'center',
  },
  amountPrimary: {
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  amountTicker: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  amountUsd: {
    marginTop: 6,
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsList: {
    marginTop: 28,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  detailValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '50%',
  },
  detailValue: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'right',
  },
  explorerButton: {
    alignSelf: 'center',
    width: '100%',
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  explorerText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  tokenTransfersBlock: {
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    gap: 8,
  },
  tokenTransferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tokenIconContainer: {
    width: 32,
    height: 32,
  },
  tokenIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenIconText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  tokenLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  tokenTransferDetails: {
    flex: 1,
  },
  tokenName: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  tokenAmountContainer: {
    alignItems: 'flex-end',
  },
  tokenAmount: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '400',
  },
  timelineContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  timelineInnerContainer: {
    minHeight: 104,
  },
  timelineTime: {
    textAlign: 'right',
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginLeft: 'auto',
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255)',
    flex: 1,
    margin: 0,
    padding: 0,
  },
  timelineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: 0,
    padding: 0,
    width: '100%',
  },
  timelineDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    margin: 0,
    padding: 0,
  },
  timelineCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  timelineRowContainer: {
    alignItems: 'flex-start',
    margin: 0,
    padding: 0,
  },
  timelineEventContainer: {
    flex: 1,
    height: 'auto',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    margin: 0,
    padding: 0,
  },
  timelineDetailContainer: {
    flex: 1,
    marginHorizontal: 0,
    marginTop: -12,
    marginBottom: 6,
    paddingTop: 0,
    paddingBottom: 6,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  timelineDetailContainerLast: {
    marginBottom: 0,
    paddingBottom: 0,
  },
  timelineIconStyle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineListView: {
    margin: 0,
    padding: 0,
    flexGrow: 1,
  },
});
