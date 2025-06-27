import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router';
import writeQR from '@paulmillr/qr';

import { AskMnemonicContext } from '../../hooks/AskMnemonicContext';
import { Button } from './DesignSystem';
import { ThemedText } from '../../components/ThemedText';

const SeedBackup: React.FC = () => {
  const navigate = useNavigate();
  const { askMnemonic } = useContext(AskMnemonicContext);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [mnemonic, setMnemonic] = useState<string>('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  const generateQRCode = (text: string) => {
    const gifBytes = writeQR(text, 'gif', {
      scale: text.length > 43 ? 4 : 7,
    });
    const blob = new Blob([gifBytes], { type: 'image/gif' });
    return URL.createObjectURL(blob);
  };

  const handleUnlockWallet = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Use the existing askMnemonic function to get the decrypted mnemonic
      const decryptedMnemonic = await askMnemonic();
      setMnemonic(decryptedMnemonic);

      // Generate QR code for the mnemonic
      const qrDataUrl = generateQRCode(decryptedMnemonic);
      setQrCodeDataUrl(qrDataUrl);
    } catch (error: any) {
      console.error('Failed to unlock wallet:', error);
      setError('Failed to unlock wallet. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/settings');
  };

  return (
    <div>
      <div>
        <ThemedText type="headline">Seed Backup</ThemedText>
      </div>
      <ThemedText type="paragraph" style={{ marginBottom: '20px' }}>
        View your wallet's seed phrase for backup purposes
      </ThemedText>

      {!mnemonic ? (
        <div style={{ textAlign: 'center' }}>
          {error && (
            <div style={{ marginBottom: '15px' }}>
              <ThemedText style={{ color: '#dc3545', fontSize: '14px' }}>{error}</ThemedText>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <Button onClick={handleBack} disabled={isLoading} style={{ backgroundColor: '#6c757d' }}>
              Back
            </Button>
            <Button onClick={handleUnlockWallet} disabled={isLoading}>
              {isLoading ? 'Unlocking...' : 'View Seed Phrase'}
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <ThemedText type="paragraph" style={{ marginBottom: '15px', fontSize: '14px', color: '#666' }}>
            Write down these 12 words in a secure location. Anyone with access to this seed phrase can control your wallet.
          </ThemedText>

          {qrCodeDataUrl && (
            <div style={{ marginBottom: '20px' }}>
              <img src={qrCodeDataUrl} alt="Seed phrase QR code" style={{ maxWidth: '200px', height: 'auto' }} />
            </div>
          )}

          <div
            style={{
              backgroundColor: '#f8f9fa',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '20px',
              textAlign: 'left',
            }}
          >
            <ThemedText
              style={{
                fontSize: '16px',
                lineHeight: '1.6',
                wordBreak: 'break-word',
                fontFamily: 'monospace',
              }}
            >
              {mnemonic}
            </ThemedText>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <Button onClick={handleBack}>Back to Settings</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SeedBackup;
