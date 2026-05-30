import { useEffect } from "react";

import { ensureTunnelBootstrapped } from "../../features/mcp/tunnel-desktop";

/** One-shot tunnel bootstrap when wallet shell is ready. */
export function TunnelBootstrap() {
  useEffect(() => {
    void ensureTunnelBootstrapped();
  }, []);

  return null;
}
