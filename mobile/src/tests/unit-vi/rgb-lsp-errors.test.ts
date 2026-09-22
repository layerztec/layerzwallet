import { describe, expect, it } from 'vitest';

import { LSP_LOOP_HINT, LSP_NO_CHANNEL_HINT, humanizeLspError } from '../../modules/rgb-lsp-errors';

describe('humanizeLspError', () => {
  it.each([
    'Invalid peer info: /apay/new requires a live channel with the invoice-host peer',
    'LSP did not provision a Lightning Address for 0355d7… (ensure the wallet is connected to the LSP). Last error: HTTP 404',
    'LspError: LSP /lightning_address/by_pubkey/03… → HTTP 404: {"error":"lightning address account not found"}',
    'No usable RGB channel after 120s',
  ])('maps the "no channel yet" family to one actionable hint: %s', (msg) => {
    expect(humanizeLspError(new Error(msg), 'fallback')).toBe(LSP_NO_CHANNEL_HINT);
  });

  it('explains the own-LSP loop rejection on the external-invoice path', () => {
    expect(humanizeLspError(new Error('LSP /lightning_send → HTTP 400: {"error":"invoice is payable to this LSP itself"}'), 'fallback')).toBe(LSP_LOOP_HINT);
  });

  it('passes unrelated errors through verbatim so they stay diagnosable', () => {
    expect(humanizeLspError(new Error('HTTP 400: rgb_invoice.duration_seconds must match'), 'fallback')).toBe('HTTP 400: rgb_invoice.duration_seconds must match');
  });

  it('falls back when the error carries no message', () => {
    expect(humanizeLspError({}, 'fallback')).toBe('fallback');
    expect(humanizeLspError(undefined, 'fallback')).toBe('fallback');
  });
});
