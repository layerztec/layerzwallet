/**
 * MCP server `instructions` (initialize) and shared agent guidance for tool descriptions.
 */

/** Reused in tool descriptions and server instructions. */
export const MCP_BASE_UNITS_GUIDANCE =
  '**Amount units:** Every `*_base_units` field is **already** the smallest on-chain/SDK unit (positive integer string, no decimal point). The `decimals` field is display metadata only — **do not** multiply by `10^decimals` to "convert to base units". Wrong: `balance_base_units * 10^8` (or `* 10^decimals`). Right: copy `balance_base_units` verbatim into amount fields, or use a smaller integer ≤ balance.';

/**
 * Returned on MCP `initialize` for hosts that inject server instructions into the model context.
 * Keep scannable; per-tool descriptions carry parameter-level detail.
 */
export const MCP_SERVER_INSTRUCTIONS = [
  'You are connected to the Layerz Wallet MCP server. Use only the tools exposed here; do not guess wallet state.',
  '',
  MCP_BASE_UNITS_GUIDANCE,
  '',
  '**Swaps (Spark BTC ↔ USDB):**',
  '1. `get_network_balance` (network `spark`) for selling BTC, or `list_tokens` (network `spark`) for selling USDB.',
  '2. Copy `balance_base_units` verbatim into `get_swap_quote` `send_amount_base_units` (or a smaller integer ≤ balance).',
  '3. Present the quote to the user; pass `quote_id` verbatim to `execute_swap`. Quotes expire in ~60s.',
  '4. `get_swap_quote` does not move funds; `execute_swap` is irreversible.',
  '',
  '**Tokens & IDs:** Copy `token_id`, `quote_id`, and BOLT11 invoices exactly from tool JSON — never from chat summaries.',
  '',
  '**Lightning:** `pay_lightning_invoice` blocks until done (often 15–60s+). Use HTTP read timeout ≥120s. Do not retry the same invoice without checking payment status.',
  '',
  '**Networks:** Call `list_networks` first; use network ids exactly as returned.',
].join('\n');
