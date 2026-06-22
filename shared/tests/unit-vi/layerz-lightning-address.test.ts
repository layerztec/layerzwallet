import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetBySparkAddress, mockCreateClient } = vi.hoisted(() => ({
  mockGetBySparkAddress: vi.fn(),
  mockCreateClient: vi.fn(() => ({})),
}));

vi.mock('../../openapi/generated/layerzme', () => ({
  getApiUsersBySparkAddressBySparkAddress: mockGetBySparkAddress,
}));

vi.mock('../../openapi/generated/layerzme/client', () => ({
  createClient: mockCreateClient,
}));

import { LAYERZ_ME_DOMAIN, lookupLayerzLightningAddress, resolveLayerzLightningAddress } from '../../modules/layerz-lightning-address';

const SPARK_ADDRESS = 'spark1testaddress';

describe('resolveLayerzLightningAddress', () => {
  beforeEach(() => {
    mockGetBySparkAddress.mockReset();
  });

  it('returns claimed username@layerz.me when registered', async () => {
    mockGetBySparkAddress.mockResolvedValueOnce({ data: { username: 'alice' } });
    await expect(resolveLayerzLightningAddress(SPARK_ADDRESS)).resolves.toBe(`alice@${LAYERZ_ME_DOMAIN}`);
  });

  it('falls back to spark-address@layerz.me when no username is claimed', async () => {
    mockGetBySparkAddress.mockResolvedValueOnce({ data: {} });
    await expect(resolveLayerzLightningAddress(SPARK_ADDRESS)).resolves.toBe(`${SPARK_ADDRESS}@${LAYERZ_ME_DOMAIN}`);
  });

  it('falls back to spark-address@layerz.me when lookup throws', async () => {
    mockGetBySparkAddress.mockRejectedValueOnce(new Error('layerz.me 500'));
    await expect(resolveLayerzLightningAddress(SPARK_ADDRESS)).resolves.toBe(`${SPARK_ADDRESS}@${LAYERZ_ME_DOMAIN}`);
  });

  it('lookupLayerzLightningAddress returns structured result', async () => {
    mockGetBySparkAddress.mockResolvedValueOnce({ data: { username: 'alice' } });
    await expect(lookupLayerzLightningAddress(SPARK_ADDRESS)).resolves.toEqual({
      lightningAddress: `alice@${LAYERZ_ME_DOMAIN}`,
      username: 'alice',
      claimed: true,
    });
  });
});
