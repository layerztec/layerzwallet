import React from 'react';

/**
 * Shared layout/styles for the multi-step send flows (SendAccountBased, SendEvm, SendBtc).
 * Covers the address/amount step chrome and the Next button. Confirm-step styles live in
 * `SendConfirmView`.
 */
export const sendFormStyles: Record<string, React.CSSProperties> = {
  stepContainer: {
    flex: '1 1 auto',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    padding: '0 16px 24px',
  },
  stepScroll: {
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
  },
  inputSection: {
    marginBottom: 30,
  },
  addressInputContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    height: 64,
    boxSizing: 'border-box',
    paddingLeft: 24,
    paddingRight: 12,
    gap: 12,
  },
  addressInputWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  addressInputLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    fontWeight: 400,
    marginBottom: 4,
  },
  addressInput: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    padding: 0,
    margin: 0,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    width: '100%',
  },
  errorRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  errorRowText: {
    color: 'white',
    fontSize: 14,
  },
  continueButton: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    padding: '16px 0',
    borderRadius: 16,
    border: 'none',
    gap: 8,
    marginTop: 16,
    cursor: 'pointer',
    width: '100%',
    flex: '0 0 auto',
  },
  continueButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: 600,
  },
  disabledButton: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};
