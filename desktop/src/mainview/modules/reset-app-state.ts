import { setMasterSeed } from "@shared/modules/wallet-utils";

import { BackgroundCaller } from "./background-caller";
import { getDesktopRpc } from "./init-electrobun";

/** Wipes persisted storage, in-memory wallet cache, and reloads the app. */
export async function resetAppState(): Promise<void> {
  await BackgroundCaller.clear();
  setMasterSeed("");

  try {
    await globalThis.breezAdapter?.disconnect?.();
  } catch {
    // ignore
  }

  await getDesktopRpc().request.storageClear({});
  await getDesktopRpc().request.secureStorageClear({});
  window.location.reload();
}
