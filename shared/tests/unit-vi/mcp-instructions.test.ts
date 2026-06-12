import { describe, it, expect } from 'vitest';

import { mcpBaseUnitsToHumanReadable } from '../../features/mcp/modules/mcp-instructions';

describe('mcpBaseUnitsToHumanReadable', () => {
  it('converts sats to BTC (8 decimals)', () => {
    expect(mcpBaseUnitsToHumanReadable('100000', 8)).toBe('0.001');
    expect(mcpBaseUnitsToHumanReadable('100000000', 8)).toBe('1');
  });

  it('converts 6-decimal token units', () => {
    expect(mcpBaseUnitsToHumanReadable('99500000', 6)).toBe('99.5');
  });

  it('returns null for null/empty input', () => {
    expect(mcpBaseUnitsToHumanReadable(null, 8)).toBeNull();
    expect(mcpBaseUnitsToHumanReadable('', 8)).toBeNull();
  });
});
