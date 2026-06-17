import { Bot, Check, Copy } from 'lucide-react';
import React, { useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router';

import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getMcpLocalMode, getMcpPublicUrl, getMcpStatus, subscribeMcp } from '../features/mcp/tunnel-desktop';

import { DetachedSheet } from '../components/DetachedSheet';
import { McpLocalModeToggle } from '../components/mcp/McpLocalModeToggle';
import './McpTunnelUrlModal.css';

/** Web port of mobile `McpTunnelUrlModal`. */
const McpTunnelUrlModal: React.FC = () => {
  const navigate = useNavigate();
  const { network } = useContext(NetworkContext);
  const publicUrl = useSyncExternalStore(subscribeMcp, getMcpPublicUrl, getMcpPublicUrl);
  const status = useSyncExternalStore(subscribeMcp, getMcpStatus, getMcpStatus);
  const localMode = useSyncExternalStore(subscribeMcp, getMcpLocalMode, getMcpLocalMode);

  const urlLine = publicUrl ?? (status === 'connecting' ? 'Connecting…' : 'Not available yet');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = () => {
    if (!publicUrl) return;
    void navigator.clipboard.writeText(publicUrl).then(
      () => setCopied(true),
      () => {}
    );
  };

  return (
    <DetachedSheet variant={network} onClose={() => navigate(-1)}>
      <div className="mcp-tunnel-url-body">
        <Bot className="mcp-tunnel-url-icon" size={52} strokeWidth={1.5} aria-hidden />
        <h2 className="mcp-tunnel-url-title">Agent</h2>

        <div className="mcp-tunnel-url-row">
          <p className="mcp-tunnel-url-text" title={publicUrl ?? undefined}>
            {urlLine}
          </p>
          <button
            type="button"
            className={`mcp-tunnel-url-copy${copied ? ' mcp-tunnel-url-copy--copied' : ''}`}
            onClick={handleCopy}
            disabled={!publicUrl}
            aria-label={copied ? 'URL copied' : 'Copy URL'}
          >
            {copied ? (
              <>
                <Check size={22} strokeWidth={2.5} aria-hidden />
                <span className="mcp-tunnel-url-copy-label">Copied</span>
              </>
            ) : (
              <Copy size={22} strokeWidth={2} aria-hidden />
            )}
          </button>
        </div>

        <McpLocalModeToggle />

        <p className="mcp-tunnel-url-hint">
          {!publicUrl
            ? 'Inactive — press play on the Agent screen to start it, then the URL appears here.'
            : localMode
              ? 'Copy this URL for a local AI agent. The token in the link is its key: anyone on your network who has it can run wallet actions, so only share it on a network you trust.'
              : 'Copy this URL for your AI provider. The token in the link is its key: anyone with it can run MCP actions on this wallet — keep it secret.'}
        </p>
      </div>
    </DetachedSheet>
  );
};

export default McpTunnelUrlModal;
