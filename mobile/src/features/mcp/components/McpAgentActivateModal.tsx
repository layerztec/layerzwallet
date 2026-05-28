import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DetachedSheet from '@/components/DetachedSheet';
import Pressable from '@/components/Pressable';
import { ThemedText } from '@/components/ThemedText';
import { NetworkContext } from '@shared/hooks/NetworkContext';

import { connectTunnel } from '../modules/tunnel';

/**
 * Bottom-sheet shown when the user lands on the MCP automation account while the
 * tunnel is in `'disconnected'` state (never started or explicitly paused).
 * Tapping "Activate" opens the tunnel and replaces this sheet with the URL modal
 * so the user can grab/share the freshly minted endpoint.
 */
export default function McpAgentActivateModal() {
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const tunnelUrlRoute = './McpTunnelUrlModal' as const;

  const handleActivate = () => {
    // Fire and forget — replace with the URL modal immediately so the user gets
    // feedback while the WS handshake is still in progress.
    void connectTunnel();
    router.replace(tunnelUrlRoute);
  };

  return (
    <DetachedSheet variant={network} onClose={() => router.back()} accessible={false}>
      <SafeAreaView style={styles.safe} edges={Platform.OS === 'ios' ? ['left', 'right', 'bottom'] : ['left', 'right']}>
        <View accessible={false} style={styles.body}>
          <MaterialCommunityIcons name="robot-outline" size={52} color="rgba(255,255,255,0.95)" style={styles.icon} />
          <ThemedText type="sfProRounded" style={styles.title}>
            Agent
          </ThemedText>

          <ThemedText style={styles.subtitle}>Automate payments, trade and control your wallet from your messaging or AI provider.</ThemedText>

          <Pressable onPress={handleActivate} style={styles.activateBtn} accessibilityRole="button" accessibilityLabel="Activate agent" testID="McpAgentActivateButton">
            <ThemedText style={styles.activateLabel}>Activate</ThemedText>
          </Pressable>
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
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  activateBtn: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activateLabel: {
    color: '#000',
    fontSize: 17,
    fontWeight: '700',
  },
});
