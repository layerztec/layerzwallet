import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { Platform, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DetachedSheet from '@/components/DetachedSheet';
import { ThemedText } from '@/components/ThemedText';
import { NetworkContext } from '@shared/hooks/NetworkContext';

type McpPermissionRow = {
  /** Stable id — used as the storage key suffix. */
  key: string;
  /** User-facing label shown in the modal. */
  label: string;
};

/**
 * Capability buckets the agent can be granted, mirroring the tool groups in
 * `mcp-calls.ts`. Order is the display order. Keep `key` stable — values will
 * be persisted under it once the toggles become functional.
 */
const PERMISSION_ROWS: McpPermissionRow[] = [
  { key: 'view_balances', label: 'View balances' },
  { key: 'view_addresses', label: 'View receive addresses' },
  { key: 'send_tokens', label: 'Send tokens' },
  { key: 'send_nfts', label: 'Send NFTs' },
  { key: 'pay_invoices', label: 'Pay Lightning invoices' },
  { key: 'execute_swaps', label: 'Execute swaps' },
];

export default function McpPermissionsModal() {
  const router = useRouter();
  const { network } = useContext(NetworkContext);

  return (
    <DetachedSheet variant={network} onClose={() => router.back()} accessible={false}>
      <SafeAreaView style={styles.safe} edges={Platform.OS === 'ios' ? ['left', 'right', 'bottom'] : ['left', 'right']}>
        <View accessible={false} style={styles.body}>
          <MaterialCommunityIcons name="robot-outline" size={52} color="rgba(255,255,255,0.95)" style={styles.icon} />
          <ThemedText type="sfProRounded" style={styles.title}>
            Agent
          </ThemedText>

          <ThemedText style={styles.subtitle}>Define the permissions your agent should have.</ThemedText>

          <View style={styles.permissionsCard}>
            {PERMISSION_ROWS.map((row, index) => (
              <View key={row.key} style={[styles.row, index < PERMISSION_ROWS.length - 1 && styles.rowDivider]}>
                <ThemedText style={styles.rowLabel}>{row.label}</ThemedText>
                <Switch value disabled trackColor={{ false: 'rgba(255,255,255,0.15)', true: '#34C759' }} thumbColor="#ffffff" ios_backgroundColor="rgba(255,255,255,0.15)" />
              </View>
            ))}
          </View>
        </View>
      </SafeAreaView>
    </DetachedSheet>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  body: {
    marginHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 8,
    alignItems: 'center',
  },
  icon: {
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  permissionsCard: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    minHeight: 64,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  rowLabel: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '400',
  },
});
