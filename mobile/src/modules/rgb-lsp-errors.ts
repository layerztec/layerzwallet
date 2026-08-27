/**
 * Turn raw LSP / SDK error strings into something a user can act on.
 *
 * The beta.29 two-asset LSP surfaces a few precondition failures verbatim
 * (`/apay/new requires a live channel with the invoice-host peer`, HTTP 404
 * `lightning address account not found`, `LSP did not provision a Lightning
 * Address for <pubkey>`). They all mean the same thing: the LSP has not opened
 * this wallet's LNUSDT channel yet — which it does on its own cron a minute or
 * two after the wallet connects, once the wallet holds some tBTC. Say that
 * instead of the raw server text. Anything unrecognized falls through
 * untouched so real errors stay diagnosable.
 */
const NO_CHANNEL_YET = /requires a live channel|did not provision a Lightning Address|lightning address account not found|No usable RGB channel/i;

export const LSP_NO_CHANNEL_HINT =
  'Not available yet — the LSP first has to open your Lightning channel. That happens automatically a minute or two after the wallet connects (it needs some tBTC on-chain). Try again shortly.';

export function humanizeLspError(e: unknown, fallback: string): string {
  const msg = (e as any)?.message ?? (typeof e === 'string' ? e : '');
  if (NO_CHANNEL_YET.test(msg)) return LSP_NO_CHANNEL_HINT;
  return msg || fallback;
}
