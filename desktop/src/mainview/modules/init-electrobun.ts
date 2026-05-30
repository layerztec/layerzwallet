import { Electroview } from "electrobun/view";

import type { DesktopAppRPC } from "../../shared/desktop-storage-rpc";

type DesktopRpc = ReturnType<typeof Electroview.defineRPC<DesktopAppRPC>>;

let desktopRpc: DesktopRpc | null = null;

/** Boot Electrobun RPC before any LayerzStorage access (required for CEF persistence). */
export function initElectrobunRpc(): DesktopRpc {
  if (!desktopRpc) {
    const rpc = Electroview.defineRPC<DesktopAppRPC>({
      handlers: {
        requests: {},
        messages: {},
      },
    });
    new Electroview({ rpc });
    desktopRpc = rpc;
  }
  return desktopRpc;
}

export function getDesktopRpc(): DesktopRpc {
  if (!desktopRpc) {
    throw new Error("initElectrobunRpc() must run before storage access");
  }
  return desktopRpc;
}
