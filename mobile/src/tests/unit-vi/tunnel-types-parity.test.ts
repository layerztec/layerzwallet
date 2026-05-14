import { describe, expect, test } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// The TunnelHttpRequest / TunnelHttpResponse types are intentionally duplicated:
// once on the device in mobile/src/features/mcp/modules/tunnel.ts and once on the
// server in mcp-websocket-tunnel/server.ts (separate Bun project, no shared deps).
// This test guards against silent drift between the two definitions.

const MOBILE_TUNNEL = resolve(__dirname, '../../features/mcp/modules/tunnel.ts');
const SERVER_TUNNEL = resolve(__dirname, '../../../../mcp-websocket-tunnel/server.ts');

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

describe('Tunnel HTTP types parity (mobile <-> server)', () => {
  const mobileSource = readFileSync(MOBILE_TUNNEL, 'utf8');
  const serverSource = readFileSync(SERVER_TUNNEL, 'utf8');

  test('TunnelHttpRequest is identical on both sides', () => {
    const mobile = extractTypeBody(mobileSource, 'TunnelHttpRequest');
    const server = extractTypeBody(serverSource, 'TunnelHttpRequest');
    expect(mobile).toBe(server);
  });

  test('TunnelHttpResponse is identical on both sides', () => {
    const mobile = extractTypeBody(mobileSource, 'TunnelHttpResponse');
    const server = extractTypeBody(serverSource, 'TunnelHttpResponse');
    expect(mobile).toBe(server);
  });
});
