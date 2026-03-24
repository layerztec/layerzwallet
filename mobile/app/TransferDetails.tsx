import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Timeline from 'react-native-timeline-flatlist';

import DetachedSheet from '@/components/DetachedSheet';
import Pressable from '@/components/Pressable';
import { ThemedText } from '@/components/ThemedText';
import { LayerzStorage } from '@/src/class/layerz-storage';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { useTransferService } from '@shared/hooks/useTransferService';
import { getAssetInfo } from '@shared/models/asset-info';
import { EXECUTION_CLAIM, getStatusLabel, isActiveStatus, isTerminalStatus, TransferExecution } from '@shared/types/transfer';

const POLL_INTERVAL = 10_000;

export default function TransferDetails() {
  const { execution: jsonExecution } = useLocalSearchParams();
  const [execution, setExecution] = useState<TransferExecution>(() => JSON.parse(jsonExecution as string));
  const sendAssetInfo = getAssetInfo(execution.sendAsset);
  const receiveAssetInfo = getAssetInfo(execution.receiveAsset);
  const sameTicker = sendAssetInfo.ticker === receiveAssetInfo.ticker;
  const sendLabel = sameTicker ? sendAssetInfo.name : sendAssetInfo.ticker;
  const receiveLabel = sameTicker ? receiveAssetInfo.name : receiveAssetInfo.ticker;
  const router = useRouter();
  const { accountNumber } = useContext(AccountNumberContext);
  const transferService = useTransferService(LayerzStorage);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isTimelineExpanded, setIsTimelineExpanded] = useState(false);

  const descriptionOpacity = useSharedValue(0);
  const timestampOpacity = useSharedValue(0);
  const descriptionMaxHeight = useSharedValue(0);
  const pendingFlashOpacity = useSharedValue(1);

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

  const isActive = isActiveStatus(execution.status);

  const isClaimable = execution.status === 'claimable';
  const trackingUrl = transferService.getTrackingUrl(execution);

  // Flashing animation for active step
  useEffect(() => {
    if (isActive) {
      pendingFlashOpacity.value = withRepeat(withSequence(withTiming(0.4, { duration: 800 }), withTiming(1, { duration: 800 })), -1, false);
    } else {
      pendingFlashOpacity.value = withTiming(1, { duration: 300 });
    }
  }, [isActive, pendingFlashOpacity]);

  // Sync expand/collapse animations
  useEffect(() => {
    if (isTimelineExpanded) {
      descriptionOpacity.value = withTiming(1, { duration: 300 });
      timestampOpacity.value = withTiming(1, { duration: 300 });
      descriptionMaxHeight.value = withTiming(100, { duration: 300 });
    } else {
      descriptionOpacity.value = withTiming(0, { duration: 300 });
      timestampOpacity.value = withTiming(0, { duration: 300 });
      descriptionMaxHeight.value = withTiming(0, { duration: 300 });
    }
  }, [isTimelineExpanded, descriptionOpacity, timestampOpacity, descriptionMaxHeight]);

  // Poll for status updates on non-terminal transfers
  useEffect(() => {
    const skipPolling = isTerminalStatus(execution.status) || (execution.status === 'claimable' && !(execution.type === EXECUTION_CLAIM && execution.autoClaim));
    if (skipPolling) return;

    const poll = async () => {
      try {
        if (transferService.refreshTransferStatus) {
          const updated = await transferService.refreshTransferStatus(execution.id, accountNumber);
          setExecution(updated);
        }
      } catch {
        // Silently ignore — will retry on next interval
      }
    };

    pollTimer.current = setInterval(poll, POLL_INTERVAL);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [execution.status, execution.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTimeline = () => {
    setIsTimelineExpanded(!isTimelineExpanded);
  };

  const handleSheetClose = () => {
    router.back();
  };

  const handleCopy = async (text?: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
  };

  const formattedDate = useMemo(() => {
    const d = new Date(execution.createdAt * 1000);
    const dateStr = d.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${dateStr} - ${timeStr.toLowerCase()}`;
  }, [execution.createdAt]);

  // Timeline data — driven by service-defined steps
  const timelineData = useMemo(() => {
    const steps = transferService.getTimelineSteps(execution);

    const white = '#FFFFFF';
    const gray = 'rgba(255, 255, 255, 0.3)';
    const red = '#FF3B30';

    const formatTime = (ts: number) => {
      const d = new Date(ts * 1000);
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    return steps.map((step) => {
      const isReached = step.status === 'completed' || step.status === 'active';
      const isError = step.status === 'error';
      const circleColor = isError ? red : isReached ? white : gray;
      const icon = isError ? <MaterialIcons name="close" size={12} color="#FFFFFF" /> : <MaterialIcons name="check" size={12} color={isReached ? '#000000' : gray} />;

      return {
        time: step.timestamp ? formatTime(step.timestamp) : '',
        title: step.title,
        description: step.description,
        completed: isReached || isError,
        isActiveStep: step.status === 'active',
        lineColor: step.status === 'completed' ? white : isError ? red : gray,
        circleColor,
        icon,
      };
    });
  }, [execution, transferService]);

  const detailRows = useMemo(() => {
    const rows: { label: string; value: string; copyable?: boolean }[] = [];

    if (execution.serviceName) {
      const displayName = execution.serviceName === 'NativeDeposit' ? 'Native' : execution.serviceName;
      rows.push({ label: 'Provider', value: displayName });
    }

    rows.push({ label: 'Status', value: getStatusLabel(execution.status, execution) });

    if (execution.providerId) {
      rows.push({ label: 'Transfer ID', value: execution.providerId, copyable: true });
    }

    if (execution.depositAddress) {
      rows.push({ label: 'Deposit Address', value: execution.depositAddress, copyable: true });
    }
    if (execution.settleAddress) {
      rows.push({ label: 'Settle Address', value: execution.settleAddress, copyable: true });
    }

    if (execution.depositTxid) {
      rows.push({ label: 'Deposit Txid', value: execution.depositTxid, copyable: true });
    }
    if (execution.type === EXECUTION_CLAIM && execution.claimTxid) {
      rows.push({ label: 'Claim Txid', value: execution.claimTxid, copyable: true });
    }

    return rows;
  }, [execution]);

  return (
    <DetachedSheet variant={sendAssetInfo.network} onClose={handleSheetClose}>
      <SafeAreaView style={styles.safeArea} edges={Platform.OS === 'ios' ? ['top', 'left', 'right', 'bottom'] : ['left', 'right']}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.topHeader}>
            <View style={styles.iconCircle}>
              <AntDesign name="swap" size={20} color="rgba(255, 255, 255, 0.8)" style={styles.swapIcon} />
            </View>
            <View style={styles.typeTextWrap}>
              <ThemedText style={styles.typeText}>Transfer</ThemedText>
              <ThemedText style={styles.subText}>{formattedDate}</ThemedText>
            </View>
          </View>

          {/* Amounts */}
          <View style={styles.amountsBlock}>
            <ThemedText type={'sfProRounded' as any} style={styles.amountPrimary} textAlign="center">
              {execution.sendAmount}
              <ThemedText style={styles.amountTicker}> {sendLabel}</ThemedText>
            </ThemedText>
            <ThemedText style={styles.arrowText}>→</ThemedText>
            <ThemedText style={styles.receiveText}>
              {execution.receiveAmount} {receiveLabel}
            </ThemedText>
          </View>

          {/* Timeline */}
          <Pressable style={styles.timelineContainer} onPress={toggleTimeline} activeOpacity={0.9}>
            <View style={styles.timelineInnerContainer}>
              <Timeline
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
                renderTime={() => null}
                renderDetail={(rowData: any, rowDataIndex?: number) => {
                  const isCompleted = rowData?.completed !== false;
                  const isActiveStep = rowData?.isActiveStep === true;
                  const isLastItem = rowDataIndex === timelineData.length - 1;

                  return (
                    <View style={[styles.timelineDetailContainer, isLastItem && styles.timelineDetailContainerLast]}>
                      <View style={styles.timelineTitleRow}>
                        {isActiveStep ? (
                          <Animated.Text style={[styles.timelineTitle, pendingFlashAnimatedStyle, { color: 'rgba(255, 255, 255, 1.0)' }]}>{rowData?.title}</Animated.Text>
                        ) : (
                          <ThemedText style={[styles.timelineTitle, { color: isCompleted ? 'rgba(255, 255, 255, 1.0)' : 'rgba(255, 255, 255, 0.3)' }]}>{rowData?.title}</ThemedText>
                        )}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
                          {rowData?.time ? (
                            <Animated.View style={timestampAnimatedStyle}>
                              <ThemedText style={[styles.timelineTime, { color: isCompleted ? 'rgba(255, 255, 255, 1.0)' : 'rgba(255, 255, 255, 0.3)' }]}>{rowData.time}</ThemedText>
                            </Animated.View>
                          ) : null}
                        </View>
                      </View>
                      <Animated.View style={descriptionAnimatedStyle}>
                        <ThemedText style={[styles.timelineDescription, { color: isCompleted ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.3)' }]}>{rowData?.description}</ThemedText>
                      </Animated.View>
                    </View>
                  );
                }}
              />
            </View>
          </Pressable>

          {/* Claim button for NativeDeposit claimable transfers */}
          {execution.type === EXECUTION_CLAIM && isClaimable && (
            <Pressable
              style={[styles.claimButton, execution.autoClaim && !execution.autoClaimError && styles.claimButtonDisabled]}
              disabled={execution.autoClaim && !execution.autoClaimError}
              onPress={() => {
                router.push({ pathname: '/SwapXArkClaim', params: { swapJson: execution.claimSwapJson } });
              }}
            >
              <ThemedText style={styles.claimButtonText}>{execution.autoClaim && !execution.autoClaimError ? 'Claiming...' : 'Claim'}</ThemedText>
            </Pressable>
          )}

          {/* View Online */}
          {trackingUrl && (
            <Pressable style={styles.trackingButton} onPress={() => Linking.openURL(trackingUrl)}>
              <MaterialIcons name="open-in-new" size={16} color="rgba(255, 255, 255, 0.8)" />
              <ThemedText style={styles.trackingButtonText}>View Online</ThemedText>
            </Pressable>
          )}

          {/* Details */}
          <View style={styles.detailsList}>
            {detailRows.map((row) => (
              <View key={row.label} style={styles.detailRow}>
                <ThemedText style={styles.detailLabel}>{row.label}</ThemedText>
                <View style={styles.detailValueWrap}>
                  {row.copyable && (
                    <Pressable onPress={() => handleCopy(row.value)}>
                      <MaterialIcons name="content-copy" size={16} color="rgba(255, 255, 255, 0.8)" />
                    </Pressable>
                  )}
                  <View style={styles.detailValueContainer}>
                    <ThemedText style={styles.detailValue} numberOfLines={1} ellipsizeMode="middle">
                      {row.value}
                    </ThemedText>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      </SafeAreaView>
    </DetachedSheet>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flexGrow: 1,
    marginHorizontal: 16,
    paddingBottom: 16,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapIcon: {
    transform: [{ rotate: '-50deg' }],
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
    marginVertical: 48,
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
  arrowText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.4)',
    marginVertical: 4,
  },
  receiveText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  // Timeline styles — match TransactionDetails exactly
  timelineContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {},
    }),
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
  claimButton: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(33, 150, 243, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(33, 150, 243, 0.5)',
    alignItems: 'center',
  },
  claimButtonDisabled: {
    opacity: 0.5,
  },
  claimButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
  },
  trackingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  trackingButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  // Detail rows — match TransactionDetails
  detailsList: {
    marginTop: 28,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    flexShrink: 0,
    marginRight: 16,
  },
  detailValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    justifyContent: 'flex-end',
  },
  detailValueContainer: {
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
    alignItems: 'flex-end',
  },
  detailValue: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'right',
  },
});
