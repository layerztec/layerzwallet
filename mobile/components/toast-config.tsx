import React from 'react';
import { BaseToast } from 'react-native-toast-message';
import type { ToastConfig } from 'react-native-toast-message';

const dark = {
  background: '#2c2c2e',
  accent: '#34c759',
  textPrimary: '#f2f2f7',
  textSecondary: '#aeaeb2',
};

/**
 * App-level `react-native-toast-message` config. Mounted once in `_layout.tsx`.
 * Add new entries here when a feature needs a custom toast `type`.
 *
 * Current entries:
 *   - `mcpAiSuccess` — dark toast for AI-driven wallet actions (MCP feature).
 */
export const toastConfig: ToastConfig = {
  mcpAiSuccess: ({ text1, text2, onPress, text1Style, text2Style }) => (
    <BaseToast
      text1={text1}
      text2={text2}
      onPress={onPress}
      style={{
        borderLeftColor: dark.accent,
        backgroundColor: dark.background,
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 6,
      }}
      text1Style={[text1Style, { color: dark.textPrimary }]}
      text2Style={[text2Style, { color: dark.textSecondary }]}
      text1NumberOfLines={2}
      text2NumberOfLines={2}
    />
  ),
};
