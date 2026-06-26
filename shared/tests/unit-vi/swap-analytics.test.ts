import assert from 'assert';
import { describe, it } from 'vitest';

import { buildSwapCompletedProperties } from '../../modules/swap-analytics';
import type { AssetId } from '../../types/asset';
import type { TransferExecution } from '../../types/transfer';

/** Minimal execution stub — buildSwapCompletedProperties only reads these 6 fields. */
function makeExecution(partial: { sendAsset: AssetId; receiveAsset: AssetId; sendAmount: string; receiveAmount: string; serviceName?: string; id?: string }): TransferExecution {
  return {
    id: 'exec-1',
    serviceName: 'SideShift',
    ...partial,
  } as unknown as TransferExecution;
}

describe('buildSwapCompletedProperties', () => {
  it('uses SEND sats when the send asset is BTC-pegged', () => {
    const props = buildSwapCompletedProperties(makeExecution({ sendAsset: 'native:bitcoin', receiveAsset: 'token:spark:usdb', sendAmount: '0.5', receiveAmount: '30000' }));
    assert.strictEqual(props.sat, 50_000_000);
  });

  it('uses RECEIVE sats when only the receive asset is BTC-pegged', () => {
    const props = buildSwapCompletedProperties(makeExecution({ sendAsset: 'token:spark:usdb', receiveAsset: 'native:spark', sendAmount: '30000', receiveAmount: '0.25' }));
    assert.strictEqual(props.sat, 25_000_000);
  });

  it('prioritizes SEND over RECEIVE when both sides are BTC-pegged', () => {
    const props = buildSwapCompletedProperties(makeExecution({ sendAsset: 'native:bitcoin', receiveAsset: 'native:liquid', sendAmount: '1', receiveAmount: '0.99' }));
    assert.strictEqual(props.sat, 100_000_000);
  });

  it('leaves sat = 0 for token-to-token swaps', () => {
    const props = buildSwapCompletedProperties(makeExecution({ sendAsset: 'token:spark:usdb', receiveAsset: 'token:spark:usdb', sendAmount: '10', receiveAmount: '10' }));
    assert.strictEqual(props.sat, 0);
  });

  it('passes through provider, id, and asset ids', () => {
    const props = buildSwapCompletedProperties(
      makeExecution({ sendAsset: 'native:bitcoin', receiveAsset: 'native:liquid', sendAmount: '1', receiveAmount: '1', serviceName: 'Garden', id: 'abc-123' })
    );
    assert.deepStrictEqual(props, { provider: 'Garden', sendAsset: 'native:bitcoin', receiveAsset: 'native:liquid', id: 'abc-123', sat: 100_000_000 });
  });
});
