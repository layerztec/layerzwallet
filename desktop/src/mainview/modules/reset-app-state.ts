import { setMasterSeed } from '@shared/modules/wallet-utils';

import { DesktopMessageType } from '../../shared/desktop-messages';
import { teardownMcpTransport } from '../features/mcp/tunnel-desktop';
import { BackgroundCaller } from './background-caller';
import { Messenger } from './messenger';

/** Wipes persisted storage and in-memory wallet cache. Caller must navigate to onboarding. */
export async function resetAppState(): Promise<void> {
  await teardownMcpTransport();
  await BackgroundCaller.clear();
  setMasterSeed('');

  try {
    await (globalThis.breezAdapter as { disconnect?: () => Promise<void> } | undefined)?.disconnect?.();
  } catch {
    // ignore
  }

  await Messenger.send(DesktopMessageType.STORAGE_CLEAR, []);
}
