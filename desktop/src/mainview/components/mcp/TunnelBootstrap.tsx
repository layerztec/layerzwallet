import { useEffect } from 'react';

import { ensureMcpBootstrapped, teardownMcpTransport } from '../../features/mcp/tunnel-desktop';

/** One-shot MCP bootstrap when wallet shell is ready (tunnel client + restore local mode). */
export function TunnelBootstrap() {
  useEffect(() => {
    void ensureMcpBootstrapped();
    return () => {
      void teardownMcpTransport();
    };
  }, []);

  return null;
}
