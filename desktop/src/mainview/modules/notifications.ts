import { DesktopMessageType, type DesktopNotificationOptions } from '../../shared/desktop-messages';
import { Messenger } from './messenger';

/**
 * Fires a native OS-level notification via the Bun process (Electrobun `Utils.showNotification`).
 *
 * The renderer (CEF) cannot call the native notifier directly, so this hops over the
 * renderer→Bun RPC bridge. Fire-and-forget: notification failures must never break the
 * caller's flow, so errors are swallowed (and logged).
 */
export async function showDesktopNotification(options: DesktopNotificationOptions): Promise<void> {
  try {
    await Messenger.send(DesktopMessageType.SHOW_NOTIFICATION, [options]);
  } catch (err) {
    console.error('[notifications] failed to show OS notification:', err);
  }
}
