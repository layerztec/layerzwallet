import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

import Pressable from '@/components/Pressable';
import { ThemedText } from '@/components/ThemedText';

import { getMcpActivityLog, mcpActivityLogIsFull, subscribeMcpActivityLog } from '../modules/mcp-activity-log';
import { connectTunnel, disconnectTunnel, getTunnelConnectionStatus, subscribeTunnelConnection } from '../modules/tunnel';

export function McpTunnelStatusRow() {
  const router = useRouter();
  const tunnelUrlRoute = './McpTunnelUrlModal' as const;
  const status = useSyncExternalStore(subscribeTunnelConnection, getTunnelConnectionStatus, getTunnelConnectionStatus);
  const activityLines = useSyncExternalStore(subscribeMcpActivityLog, getMcpActivityLog, getMcpActivityLog);
  const connecting = status === 'connecting';

  const pill = status === 'connected' ? 'Active' : status === 'connecting' ? 'Connecting...' : 'Inactive';
  const detail = status === 'connected' ? 'AI agent ready!' : status === 'connecting' ? 'Linking to tunnel' : 'Not connected';
  const dot = status === 'connected' ? '#22c55e' : status === 'connecting' ? '#eab308' : '#ef4444';
  const activityLogFull = mcpActivityLogIsFull(activityLines.length);

  return (
    <View style={styles.section}>
      <View style={styles.row}>
        <View style={styles.pill}>
          <View style={[styles.dot, { backgroundColor: dot }]} />
          <ThemedText style={styles.pillText}>{pill}</ThemedText>
        </View>
        <Pressable style={styles.detailPressable} onPress={() => router.push(tunnelUrlRoute)} accessibilityRole="button" accessibilityLabel="Agent tunnel URL">
          <ThemedText style={styles.detail} numberOfLines={1}>
            {detail}
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => {
            if (status === 'connected') void disconnectTunnel();
            else if (status === 'disconnected') {
              void connectTunnel().then(() => router.push(tunnelUrlRoute));
            }
          }}
          disabled={connecting}
          style={styles.circleBtn}
          accessibilityLabel={status === 'connected' ? 'Pause tunnel' : connecting ? 'Tunnel connecting' : 'Resume tunnel'}
          accessibilityRole="button"
        >
          <Ionicons name={status === 'disconnected' ? 'play' : 'pause'} size={22} color="#000" style={connecting ? styles.pauseDimmed : undefined} />
        </Pressable>
      </View>

      {activityLines.length > 0 ? (
        <View style={styles.activityLog}>
          {activityLines.map((line, index) => {
            const last = index === activityLines.length - 1;
            const oldestFading = activityLogFull && index === 0;
            const lineStyle = last ? styles.activityLatest : oldestFading ? styles.activityFading : styles.activityOlder;
            return (
              <ThemedText key={`${index}-${line}`} style={[styles.activityLine, lineStyle]}>
                {line}
              </ThemedText>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 4,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  activityLog: {
    marginTop: 10,
    paddingVertical: 10,
    gap: 4,
  },
  activityLine: {
    fontSize: 14,
    lineHeight: 20,
  },
  activityOlder: {
    color: 'rgba(255, 255, 255, 0.42)',
  },
  activityFading: {
    color: 'rgba(255, 255, 255, 0.22)',
  },
  activityLatest: {
    color: 'rgba(255, 255, 255, 0.96)',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pillText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },
  detailPressable: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
    justifyContent: 'center',
    minHeight: 44,
  },
  detail: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.55)',
    fontWeight: '400',
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseDimmed: {
    opacity: 0.38,
  },
});
