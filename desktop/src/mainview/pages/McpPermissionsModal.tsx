import { Bot } from 'lucide-react';
import React, { useContext } from 'react';
import { useNavigate } from 'react-router';

import { NetworkContext } from '@shared/hooks/NetworkContext';

import { DetachedSheet } from '../components/DetachedSheet';
import './McpPermissionsModal.css';

type McpPermissionRow = {
  key: string;
  label: string;
};

const PERMISSION_ROWS: McpPermissionRow[] = [
  { key: 'view_balances', label: 'View balances' },
  { key: 'view_addresses', label: 'View receive addresses' },
  { key: 'send_tokens', label: 'Send tokens' },
  { key: 'send_nfts', label: 'Send NFTs' },
  { key: 'pay_invoices', label: 'Pay Lightning invoices' },
  { key: 'execute_swaps', label: 'Execute swaps' },
];

/** Web port of mobile `McpPermissionsModal`. */
const McpPermissionsModal: React.FC = () => {
  const navigate = useNavigate();
  const { network } = useContext(NetworkContext);

  return (
    <DetachedSheet variant={network} onClose={() => navigate(-1)}>
      <div className="mcp-permissions-body">
        <Bot className="mcp-permissions-icon" size={52} strokeWidth={1.5} aria-hidden />
        <h2 className="mcp-permissions-title">Agent</h2>
        <p className="mcp-permissions-subtitle">Define the permissions your agent should have.</p>

        <div className="mcp-permissions-card">
          {PERMISSION_ROWS.map((row, index) => (
            <div key={row.key} className={`mcp-permissions-row${index < PERMISSION_ROWS.length - 1 ? ' mcp-permissions-row--divider' : ''}`}>
              <span className="mcp-permissions-row-label">{row.label}</span>
              <label className="mcp-permission-switch" aria-label={row.label}>
                <input type="checkbox" checked disabled readOnly />
                <span className="mcp-permission-switch-track" />
              </label>
            </div>
          ))}
        </div>
      </div>
    </DetachedSheet>
  );
};

export default McpPermissionsModal;
