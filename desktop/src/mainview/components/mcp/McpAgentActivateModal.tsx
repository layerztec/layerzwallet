import { Bot, X } from 'lucide-react';
import React, { useContext } from 'react';
import { useNavigate } from 'react-router';

import { NetworkContext } from '@shared/hooks/NetworkContext';
import { connectTunnel } from '../../features/mcp/tunnel-desktop';

import { DetachedSheet } from '../DetachedSheet';
import '../../pages/McpAgentActivateModal.css';

type McpAgentActivateModalProps = {
  onClose: () => void;
};

/** Overlay on Home — dismiss without leaving the home route (avoids remount loop). */
export const McpAgentActivateModal: React.FC<McpAgentActivateModalProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const { network } = useContext(NetworkContext);

  const handleActivate = () => {
    onClose();
    void connectTunnel();
    navigate('/mcp-tunnel-url-modal');
  };

  return (
    <DetachedSheet variant={network} onClose={onClose}>
      <div className="mcp-agent-activate-body">
        <button type="button" className="mcp-agent-activate-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <Bot className="mcp-agent-activate-icon" size={52} strokeWidth={1.5} aria-hidden />
        <h2 className="mcp-agent-activate-title">Agent</h2>
        <p className="mcp-agent-activate-subtitle">Automate payments, trade and control your wallet from your messaging or AI provider.</p>
        <button type="button" className="mcp-agent-activate-btn" onClick={handleActivate} aria-label="Activate agent" data-testid="McpAgentActivateButton">
          Activate
        </button>
      </div>
    </DetachedSheet>
  );
};
