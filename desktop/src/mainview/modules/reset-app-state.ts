import { setMasterSeed } from "@shared/modules/wallet-utils";

import { DesktopMessageType } from "../../shared/desktop-messages";
import { BackgroundCaller } from "./background-caller";
import { Messenger } from "./messenger";

/** Wipes persisted storage, in-memory wallet cache, and reloads the app. */
export async function resetAppState(): Promise<void> {
  await BackgroundCaller.clear();
  setMasterSeed("");

  try {
    await globalThis.breezAdapter?.disconnect?.();
  } catch {
    // ignore
  }

  await Messenger.send(DesktopMessageType.STORAGE_CLEAR, []);
  window.location.reload();
}
