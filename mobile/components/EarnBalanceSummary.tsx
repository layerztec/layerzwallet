import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { overlayBackgroundSections } from '@shared/constants/Colors';

const LABEL_GRAY = 'rgba(255, 255, 255, 0.6)';
const POSITIVE_GREEN = '#FFFFFF';
const SECTION_BORDER = 'rgba(255, 255, 255, 0.1)';
const BORDER_RADIUS = 12;

export function formatEarnUsd(amount: number, options?: { showSign?: boolean }): string {
  const sign = options?.showSign && amount > 0 ? '+' : '';
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(abs);
  return amount < 0 ? `-${formatted}` : `${sign}${formatted}`;
}

export interface EarnBalanceSummaryProps {
  earnTotalUsd: number;
  rewards30dUsd: number;
  rewardsLifetimeUsd: number;
  isLoading: boolean;
}

/**
 * Earn hero + two side-by-side reward cards (same panel style as SectionContainer body).
 */
const EarnBalanceSummary: React.FC<EarnBalanceSummaryProps> = ({ earnTotalUsd, rewards30dUsd, rewardsLifetimeUsd, isLoading }) => {
  return (
    <View style={styles.container}>
      <ThemedText style={styles.heroLabel}>Earn balance</ThemedText>
      {isLoading ? (
        <ActivityIndicator size="small" color="#ffffff" style={styles.loader} />
      ) : (
        <ThemedText type="sfProRounded" style={styles.heroAmount}>
          {formatEarnUsd(earnTotalUsd)}
        </ThemedText>
      )}

      <View style={styles.rewardsRow}>
        <View style={styles.rewardCard}>
          <ThemedText style={styles.rewardLabel}>Last 30d</ThemedText>
          {isLoading ? <ActivityIndicator size="small" color={POSITIVE_GREEN} /> : <ThemedText style={styles.rewardValue}>{formatEarnUsd(rewards30dUsd, { showSign: true })}</ThemedText>}
        </View>
        <View style={styles.rewardCard}>
          <ThemedText style={styles.rewardLabel}>Lifetime</ThemedText>
          {isLoading ? <ActivityIndicator size="small" color={POSITIVE_GREEN} /> : <ThemedText style={styles.rewardValue}>{formatEarnUsd(rewardsLifetimeUsd, { showSign: true })}</ThemedText>}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  heroLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    color: LABEL_GRAY,
    marginBottom: 6,
  },
  heroAmount: {
    fontSize: 40,
    lineHeight: 48,
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  loader: {
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  rewardsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  /** Matches SectionContainer inner `container` (Allocated / Available panels). */
  rewardCard: {
    flex: 1,
    backgroundColor: overlayBackgroundSections,
    borderRadius: BORDER_RADIUS,
    borderWidth: 1,
    borderColor: SECTION_BORDER,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 72,
    justifyContent: 'center',
  },
  rewardLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: LABEL_GRAY,
    marginBottom: 6,
  },
  rewardValue: {
    fontSize: 17,
    fontWeight: '700',
    color: POSITIVE_GREEN,
  },
});

export default EarnBalanceSummary;
