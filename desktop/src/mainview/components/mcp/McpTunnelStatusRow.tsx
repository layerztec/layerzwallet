import { Pause, Play } from 'lucide-react';
import React, { useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router';

import { connectTunnel, disconnectTunnel, getTunnelConnectionStatus, subscribeTunnelConnection } from '../../features/mcp/tunnel-desktop';

import { McpActivityLog } from './McpActivityLog';
import './McpTunnelStatusRow.css';

/** Desktop port of mobile `McpTunnelStatusRow`. */
export const McpTunnelStatusRow: React.FC = () => {
  const navigate = useNavigate();
  const status = useSyncExternalStore(subscribeTunnelConnection, getTunnelConnectionStatus, getTunnelConnectionStatus);
  const connecting = status === 'connecting';

  const pill = status === 'connected' ? 'Active' : status === 'connecting' ? 'Connecting...' : 'Inactive';
  const detail = status === 'connected' ? 'AI agent ready!' : status === 'connecting' ? 'Linking to tunnel' : 'Not connected';
  const dotClass = status === 'connected' ? 'mcp-tunnel-dot--active' : status === 'connecting' ? 'mcp-tunnel-dot--connecting' : 'mcp-tunnel-dot--inactive';

  return (
    <section className="mcp-tunnel-section" aria-label="AI agent tunnel status">
      <div className="mcp-tunnel-row">
        <div className="mcp-tunnel-pill">
          <span className={`mcp-tunnel-dot ${dotClass}`} aria-hidden />
          <span className="mcp-tunnel-pill-text">{pill}</span>
        </div>
        <button type="button" className="mcp-tunnel-detail-btn" onClick={() => navigate('/mcp-tunnel-url-modal')} aria-label="Agent tunnel URL">
          <span className="mcp-tunnel-detail">{detail}</span>
        </button>
        <button
          type="button"
          className={`mcp-tunnel-circle-btn${connecting ? ' mcp-tunnel-circle-btn--dimmed' : ''}`}
          onClick={() => {
            if (status === 'connected') void disconnectTunnel();
            else if (status === 'disconnected') {
              void connectTunnel().then(() => navigate('/mcp-tunnel-url-modal'));
            }
          }}
          disabled={connecting}
          aria-label={status === 'connected' ? 'Pause tunnel' : connecting ? 'Tunnel connecting' : 'Resume tunnel'}
        >
          {status === 'disconnected' ? <Play size={22} fill="currentColor" strokeWidth={0} /> : <Pause size={22} strokeWidth={2.5} />}
        </button>
      </div>

      <McpActivityLog />
    </section>
  );
};
