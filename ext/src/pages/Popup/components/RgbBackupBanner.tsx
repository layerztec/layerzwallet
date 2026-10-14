import { AlertTriangle, CloudUpload, Loader2 } from 'lucide-react';
import React, { useContext, useState } from 'react';

import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useRgbBackupStatus } from '@shared/hooks/useRgbBackupStatus';

import { BackgroundCaller } from '../../../modules/background-caller';

// Persistent banner for the RGB backup ledger — see
// tasks/ship-rgb.md.
const RgbBackupBanner: React.FC = () => {
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { status, pendingCount, lastError, retry } = useRgbBackupStatus(network, accountNumber, BackgroundCaller);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  if (status === 'synced') return null;

  const isFailed = status === 'failed';
  const title = isFailed ? 'Backup failed' : 'Backup pending';
  const detail = isFailed
    ? `${pendingCount} change${pendingCount === 1 ? '' : 's'} not yet saved to backup. Tap to retry — until then, recovery on a new device may be missing recent activity.`
    : `${pendingCount} change${pendingCount === 1 ? '' : 's'} are syncing to backup. Usually clears within seconds.`;

  const handlePress = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    setRetryError(null);
    try {
      const ok = await retry();
      if (!ok) setRetryError(lastError?.message ?? 'Unknown error. Try again in a moment, or check your network.');
    } catch (e: any) {
      setRetryError(e?.message ?? 'Unknown error.');
    } finally {
      setIsRetrying(false);
    }
  };

  const accent = isFailed ? '#ffb86b' : 'rgba(255, 255, 255, 0.9)';

  return (
    <div
      onClick={handlePress}
      data-testid="RgbBackupBanner"
      style={{
        cursor: isRetrying ? 'wait' : 'pointer',
        opacity: isRetrying ? 0.85 : 1,
        background: 'rgba(255, 255, 255, 0.06)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        borderRadius: 10,
        padding: 12,
        margin: '8px 0',
        color: 'white',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: accent,
          }}
        >
          {isRetrying ? <Loader2 size={18} className="rgb-backup-spin" /> : isFailed ? <AlertTriangle size={18} /> : <CloudUpload size={18} />}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{title}</div>
      </div>
      <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.8)', lineHeight: '17px', paddingLeft: 38 }}>{detail}</div>
      {retryError ? <div style={{ fontSize: 12, color: '#ffb1b1', marginTop: 6, paddingLeft: 38 }}>{retryError}</div> : null}
      <style>
        {`@keyframes rgb-backup-spin { to { transform: rotate(360deg); } }
          .rgb-backup-spin { animation: rgb-backup-spin 1s linear infinite; transform-origin: center; }`}
      </style>
    </div>
  );
};

export default RgbBackupBanner;
