/**
 * MCP server `instructions` (initialize) and shared agent guidance for tool descriptions.
 */

import BigNumber from 'bignumber.js';

/** Reused in tool descriptions and server instructions. */
export const MCP_BASE_UNITS_GUIDANCE =
  '**Amount units:** Every `*_base_units` field is **already** the smallest on-chain/SDK unit (positive integer string, no decimal point). The `decimals` field is display metadata only — **do not** multiply by `10^decimals` to "convert to base units". Wrong: `balance_base_units * 10^8` (or `* 10^decimals`). Right: copy `balance_base_units` verbatim into amount fields, or use a smaller integer ≤ balance. When both `balance_base_units` and `balance_human_readable` are returned, **quote `balance_human_readable` to the user** (with `ticker` / `symbol`) and use `balance_base_units` only for sends/swaps.';

/**
 * Decimal string for presenting a base-unit balance to the user (e.g. sats → BTC). Returns `null` when
 * `baseUnits` is null/empty. Trims trailing zeros after the decimal point.
 */
export function mcpBaseUnitsToHumanReadable(baseUnits: string | null | undefined, decimals: number): string | null {
  if (baseUnits == null || baseUnits === '') return null;
  const n = new BigNumber(baseUnits);
  if (!n.isFinite() || n.isNegative()) return null;
  return n
    .dividedBy(new BigNumber(10).pow(decimals))
    .toFixed(decimals)
    .replace(/\.?0+$/, '');
}

/**
 * Returned on MCP `initialize` for hosts that inject server instructions into the model context.
 * Keep scannable; per-tool descriptions carry parameter-level detail.
 */
export const MCP_SERVER_INSTRUCTIONS = [
  'You are connected to the Layerz Wallet MCP server. Use only the tools exposed here; do not guess wallet state.',
  '',
  MCP_BASE_UNITS_GUIDANCE,
  '',
  '**Balances & amounts:** Tools that return a `*_base_units` field also return its `*_human_readable` decimal counterpart (e.g. `balance_human_readable`, `amount_human_readable`, `fee_human_readable`, `total_human_readable`) plus a matching ticker/symbol where applicable (`amount_ticker`, `fee_ticker`) — show the human-readable value (with its ticker/symbol) to the user; never do decimal math yourself.',
  '',
  '**Swaps (Spark BTC ↔ USDB):**',
  '1. `get_network_balance` (network `spark`) for selling BTC, or `list_tokens` (network `spark`) for selling USDB.',
  '2. Copy `balance_base_units` verbatim into `get_swap_quote` `send_amount_base_units` (or a smaller integer ≤ balance).',
  '3. Present the quote to the user using `send_amount_human_readable` / `receive_amount_human_readable` (already decimal-corrected — never divide base units yourself); pass `quote_id` verbatim to `execute_swap`. Quotes expire in ~60s.',
  '4. `get_swap_quote` does not move funds; `execute_swap` is irreversible.',
  '',
  '**Tokens & IDs:** Copy `token_id`, `quote_id`, BOLT11 invoices, and `payment_hash` exactly from tool JSON — never from chat summaries.',
  '',
  '**Lightning:**',
  '- `pay_lightning_invoice` blocks until done (often 15–60s+). Use HTTP read timeout ≥120s. Do not retry the same invoice without checking payment status.',
  '- `create_lightning_invoice` returns both `invoice` (BOLT11) and `payment_hash`. To check if it was paid, call `is_invoice_paid` with the `payment_hash`.',
  '',
  '**Networks:** Call `list_networks` first; use network ids exactly as returned.',
].join('\n');
