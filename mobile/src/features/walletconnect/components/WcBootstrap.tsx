import { router } from 'expo-router';
import { useEffect } from 'react';

import { wcService } from '@/src/features/walletconnect/modules/wc-service';

/**
 * Render-nothing bootstrap (mounted next to TunnelBootstrap in _layout):
 * - boots WalletKit on launch only when a previous run had active sessions,
 *   so restored dApp sessions can deliver requests without the user opening
 *   the pairing screen;
 * - surfaces service prompts as the approval modal route.
 */
export function WcBootstrap() {
  useEffect(() => {
    wcService.onPromptChange = (prompt) => {
      if (prompt) router.push('/WalletConnectApproveModal');
    };
    void wcService.bootstrapIfHadSessions();
    return () => {
      wcService.onPromptChange = undefined;
    };
  }, []);
  return null;
}
