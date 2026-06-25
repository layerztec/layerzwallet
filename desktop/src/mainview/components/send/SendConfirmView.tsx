import { AlertCircle } from 'lucide-react';
import React from 'react';

import { Networks } from '@shared/types/networks';

import { RadialGradientScreen } from '../home/RadialGradientScreen';
import ScreenSendHeader from '../navigation/ScreenSendHeader';
import { ThemedText } from '../ThemedText';

export interface SendConfirmViewProps {
  network: Networks;
  title: string;
  totalDisplay: string;
  totalUsd?: string;
  amount: string;
  amountTicker: string;
  amountUsdValue?: string;
  feeInNative: string;
  feeTicker: string;
  usdFee?: string;
  address: string;
  error: string;
  isSuccess: boolean;
  isBroadcasting: boolean;
  onBack: () => void;
  onConfirm: () => void;
  onClearError: () => void;
  onDone: () => void;
}

const formatAddressWithOpacity = (addr: string) => {
  if (!addr) return null;
  if (addr.length < 8) return <span style={styles.addressDisplay}>{addr}</span>;
  const midpoint = Math.floor(addr.length / 2);
  const firstHalf = addr.substring(0, midpoint);
  const secondHalf = addr.substring(midpoint);
  const first4 = addr.substring(0, 4);
  const last4 = addr.substring(addr.length - 4);
  const nbsp = '\u00A0';
  return (
    <div style={styles.addressContainer}>
      <span style={styles.addressDisplay}>
        <span style={{ ...styles.addressDisplay, ...styles.addressHighlight, ...styles.addressLetterSpacing }}>{first4}</span>
        <span style={{ ...styles.addressDisplay, ...styles.addressLetterSpacing }}>
          {nbsp}
          {firstHalf.substring(4)}
        </span>
      </span>
      <span style={styles.addressDisplay}>
        <span style={{ ...styles.addressDisplay, ...styles.addressLetterSpacing }}>
          {secondHalf.substring(0, secondHalf.length - 4)}
          {nbsp}
        </span>
        <span style={{ ...styles.addressDisplay, ...styles.addressHighlight, ...styles.addressLetterSpacing }}>{last4}</span>
      </span>
    </div>
  );
};

/**
 * Shared confirm step for all desktop send flows: shows total / details / recipient,
 * plus success and error states and the bottom action button.
 */
const SendConfirmView: React.FC<SendConfirmViewProps> = ({
  network,
  title,
  totalDisplay,
  totalUsd,
  amount,
  amountTicker,
  amountUsdValue,
  feeInNative,
  feeTicker,
  usdFee,
  address,
  error,
  isSuccess,
  isBroadcasting,
  onBack,
  onConfirm,
  onClearError,
  onDone,
}) => {
  return (
    <RadialGradientScreen network={network} className="home-screen">
      {!isSuccess && <ScreenSendHeader network={network} title={title} onBackPress={onBack} />}

      <div style={styles.confirmContainer}>
        <div style={styles.confirmScroll}>
          {error ? (
            <div style={styles.confirmErrorContainer}>
              <AlertCircle size={40} color="#FF3B30" />
              <ThemedText style={styles.confirmErrorTitle}>Error</ThemedText>
              <ThemedText style={styles.confirmErrorText}>{error}</ThemedText>
              <button type="button" style={styles.goBackButton} onClick={onClearError}>
                <ThemedText style={styles.goBackButtonText}>Go Back</ThemedText>
              </button>
            </div>
          ) : isSuccess ? (
            <div style={styles.successContainer}>
              <div style={styles.successCheck}>✓</div>
              <ThemedText type="headline" data-testid="send-success-text">
                Transaction Sent!
              </ThemedText>
            </div>
          ) : (
            <>
              <div style={styles.section}>
                <div style={styles.sectionHeader}>
                  <ThemedText style={styles.sectionHeaderText}>Total</ThemedText>
                </div>
                <div style={styles.totalCard}>
                  <ThemedText style={styles.totalAmount}>{totalDisplay}</ThemedText>
                  {totalUsd ? <ThemedText style={styles.totalUsd}>{totalUsd}</ThemedText> : null}
                </div>
              </div>

              <div style={styles.section}>
                <div style={styles.sectionHeader}>
                  <ThemedText style={styles.sectionHeaderText}>Details</ThemedText>
                </div>
                <div style={styles.detailsCard}>
                  <div style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>Amount</ThemedText>
                    <div style={styles.detailValueContainer}>
                      <ThemedText style={styles.detailValue}>
                        {amount} {amountTicker}
                      </ThemedText>
                      {amountUsdValue ? <ThemedText style={styles.detailUsd}>{amountUsdValue}</ThemedText> : null}
                    </div>
                  </div>

                  <div style={styles.divider} />

                  <div style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>Network Fee</ThemedText>
                    <div style={styles.detailValueContainer}>
                      <ThemedText style={styles.detailValue}>
                        {feeInNative} {feeTicker}
                      </ThemedText>
                      {usdFee ? <ThemedText style={styles.detailUsd}>{usdFee}</ThemedText> : null}
                    </div>
                  </div>
                </div>
              </div>

              <div style={styles.section}>
                <div style={styles.sectionHeader}>
                  <ThemedText style={styles.sectionHeaderText}>Send to</ThemedText>
                </div>
                <div style={styles.addressCard}>{formatAddressWithOpacity(address)}</div>
              </div>
            </>
          )}
        </div>

        {!error ? (
          <button
            type="button"
            style={{ ...styles.sendButton, ...(isBroadcasting ? styles.disabledButton : null) }}
            onClick={isSuccess ? onDone : onConfirm}
            disabled={isBroadcasting}
            data-testid="send-confirm-button"
          >
            <ThemedText style={styles.sendButtonText}>{isSuccess ? 'Back to Wallet' : isBroadcasting ? 'Sending...' : 'Confirm Send'}</ThemedText>
          </button>
        ) : null}
      </div>
    </RadialGradientScreen>
  );
};

const styles: Record<string, React.CSSProperties> = {
  confirmContainer: {
    flex: '1 1 auto',
    minHeight: 0,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  },
  confirmScroll: {
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
    padding: '0 16px 112px',
  },
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 18,
    padding: 2,
    marginBottom: 32,
  },
  sectionHeader: {
    padding: '2px 16px 4px',
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'left',
  },
  totalCard: {
    borderRadius: 20,
    padding: '24px 0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  totalAmount: {
    fontSize: 24,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  totalUsd: {
    fontSize: 16,
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
  },
  detailsCard: {
    borderRadius: 20,
    padding: '16px 0',
  },
  detailRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 16px',
  },
  detailLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: 400,
  },
  detailValueContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 2,
  },
  detailValue: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: 600,
    textAlign: 'right',
  },
  detailUsd: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 16,
    fontWeight: 400,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    margin: '8px 0',
  },
  addressCard: {
    borderRadius: 20,
    padding: 16,
    minHeight: 79,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 380,
    margin: '0 auto',
  },
  addressDisplay: {
    fontFamily: 'monospace',
    lineHeight: '24px',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 18,
    textAlign: 'center',
    wordBreak: 'break-all',
  },
  addressHighlight: {
    color: 'rgb(255, 255, 255)',
  },
  addressLetterSpacing: {
    letterSpacing: 1.6,
  },
  confirmErrorContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
  },
  confirmErrorTitle: {
    fontSize: 24,
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 16,
    marginBottom: 8,
  },
  confirmErrorText: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 24,
  },
  goBackButton: {
    backgroundColor: '#000000',
    padding: '16px 32px',
    borderRadius: 16,
    width: '80%',
    border: 'none',
    cursor: 'pointer',
  },
  goBackButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: 600,
  },
  successContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 20px',
    gap: 16,
  },
  successCheck: {
    color: '#4CAF50',
    fontSize: 64,
    lineHeight: 1,
  },
  sendButton: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    padding: '16px 0',
    borderRadius: 16,
    border: 'none',
    gap: 8,
    height: 56,
    boxSizing: 'border-box',
    cursor: 'pointer',
    zIndex: 1000,
  },
  sendButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: 600,
  },
};

export default SendConfirmView;
