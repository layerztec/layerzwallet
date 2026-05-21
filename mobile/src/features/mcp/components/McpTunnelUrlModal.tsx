import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useContext, useSyncExternalStore } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DetachedSheet from '@/components/DetachedSheet';
import Pressable from '@/components/Pressable';
import { ThemedText } from '@/components/ThemedText';
import { NetworkContext } from '@shared/hooks/NetworkContext';

import { getTunnelConnectionStatus, getTunnelPublicUrl, subscribeTunnelConnection } from '../modules/tunnel';

export default function McpTunnelUrlModal() {
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const publicUrl = useSyncExternalStore(subscribeTunnelConnection, getTunnelPublicUrl, getTunnelPublicUrl);
  const status = useSyncExternalStore(subscribeTunnelConnection, getTunnelConnectionStatus, getTunnelConnectionStatus);

  const urlLine = publicUrl ?? (status === 'connecting' ? 'Connecting…' : 'Not available yet');

  return (
    <DetachedSheet variant={network} onClose={() => router.back()} accessible={false}>
      <SafeAreaView style={styles.safe} edges={Platform.OS === 'ios' ? ['left', 'right', 'bottom'] : ['left', 'right']}>
        <View accessible={false} style={styles.body}>
          <MaterialCommunityIcons name="robot-outline" size={52} color="rgba(255,255,255,0.95)" style={styles.icon} />
          <ThemedText type="sfProRounded" style={styles.title}>
            Agent
          </ThemedText>

          <View style={styles.urlRow}>
            <ThemedText style={styles.urlText} numberOfLines={1} ellipsizeMode="tail">
              {urlLine}
            </ThemedText>
            <Pressable onPress={() => publicUrl && void Clipboard.setStringAsync(publicUrl)} disabled={!publicUrl} style={styles.copyBtn} accessibilityLabel="Copy URL" accessibilityRole="button">
              <Ionicons name="copy-outline" size={22} color={publicUrl ? '#fff' : 'rgba(255,255,255,0.35)'} />
            </Pressable>
          </View>

          <ThemedText style={styles.hint}>Copy this URL for your AI provider. Anyone with the link can run MCP actions on this wallet — keep it secret.</ThemedText>

          <Pressable
            onPress={() => publicUrl && void Share.share(Platform.OS === 'ios' ? { url: publicUrl } : { message: publicUrl })}
            disabled={!publicUrl}
            style={[styles.shareBtn, !publicUrl && styles.shareBtnDisabled]}
            accessibilityRole="button"
          >
            <ThemedText style={styles.shareLabel}>Share</ThemedText>
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
    marginBottom: 24,
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  urlText: {
    flex: 1,
    color: 'rgba(255,255,255,0.92)',
    fontSize: 15,
    marginRight: 8,
  },
  copyBtn: {
    padding: 4,
  },
  hint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  shareBtn: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnDisabled: {
    opacity: 0.45,
  },
  shareLabel: {
    color: '#000',
    fontSize: 17,
    fontWeight: '700',
  },
});
