import { describe, expect, test } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// The TunnelHttpRequest / TunnelHttpResponse types are intentionally duplicated:
// once in the wallet at shared/features/mcp/modules/tunnel-types.ts and once on the
// server in mcp-websocket-tunnel/server.ts (separate Bun project, no shared deps).
// This test guards against silent drift between the two definitions.

const WALLET_TUNNEL_TYPES = resolve(__dirname, '../../features/mcp/modules/tunnel-types.ts');
const SERVER_TUNNEL = resolve(__dirname, '../../../mcp-websocket-tunnel/server.ts');

function extractTypeBody(source: string, typeName: string): string {
  const re = new RegExp(`(?:export\\s+)?type\\s+${typeName}\\s*=\\s*\\{([\\s\\S]*?)\\};`, 'm');
  const match = source.match(re);
  if (!match) throw new Error(`Could not find type ${typeName}`);
  return normalize(match[1]);
}

// Normalize so cosmetic differences (quote style, indentation, trailing
// whitespace, presence/absence of `export`) don't trigger failures. We only
// care about the structural shape of the two type definitions.
function normalize(body: string): string {
  return body
    .replace(/['"]/g, '"')
    .replace(/\s+/g, ' ')
    .replace(/\s*;\s*/g, ';')
    .replace(/\s*:\s*/g, ':')
    .replace(/\s*,\s*/g, ',')
    .trim();
}

describe('Tunnel HTTP types parity (wallet <-> server)', () => {
  const walletSource = readFileSync(WALLET_TUNNEL_TYPES, 'utf8');
  const serverSource = readFileSync(SERVER_TUNNEL, 'utf8');

  test('TunnelHttpRequest is identical on both sides', () => {
    const wallet = extractTypeBody(walletSource, 'TunnelHttpRequest');
    const server = extractTypeBody(serverSource, 'TunnelHttpRequest');
    expect(wallet).toBe(server);
  });

  test('TunnelHttpResponse is identical on both sides', () => {
    const wallet = extractTypeBody(walletSource, 'TunnelHttpResponse');
    const server = extractTypeBody(serverSource, 'TunnelHttpResponse');
    expect(wallet).toBe(server);
  });
});
