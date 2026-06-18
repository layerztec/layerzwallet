import React, { useSyncExternalStore } from 'react';

import { getMcpLocalMode, setMcpLocalMode, subscribeMcp } from '../../features/mcp/tunnel-desktop';

import './McpLocalModeToggle.css';

/**
 * Switches the MCP transport between the public tunnel and the local closed-circuit
 * listener. Toggling is live: turning it on disconnects the tunnel and starts the local
 * server; turning it off does the reverse. Shared by the activate and URL modals.
 */
export const McpLocalModeToggle: React.FC = () => {
  const localMode = useSyncExternalStore(subscribeMcp, getMcpLocalMode, getMcpLocalMode);

  return (
    <label className="mcp-local-toggle">
      <input type="checkbox" className="mcp-local-toggle-input" checked={localMode} onChange={(e) => void setMcpLocalMode(e.target.checked)} data-testid="McpLocalModeToggle" />
      <span className="mcp-local-toggle-text">
        <span className="mcp-local-toggle-title">Local only (closed circuit)</span>
        <span className="mcp-local-toggle-subtitle">Expose on your local network with no tunnel — nothing leaves this machine.</span>
      </span>
    </label>
  );
};
