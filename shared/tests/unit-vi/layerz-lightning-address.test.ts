import { beforeEach, describe, expect, it, vi } from 'vitest';

import { claimLayerzLightningAddressUsername, formatLayerzLightningAddress, lookupLayerzLightningAddress, resolveLayerzLightningAddress } from '../../modules/layerz-lightning-address';

const { mockGetBySparkAddress, mockGetByUsername, mockPostUsers, mockCreateClient } = vi.hoisted(() => ({
  mockGetBySparkAddress: vi.fn(),
  mockGetByUsername: vi.fn(),
  mockPostUsers: vi.fn(),
  mockCreateClient: vi.fn(() => ({})),
}));

vi.mock('../../openapi/generated/layerzme', () => ({
  getApiUsersBySparkAddressBySparkAddress: mockGetBySparkAddress,
  getApiUsersByUsername: mockGetByUsername,
  postApiUsers: mockPostUsers,
}));

vi.mock('../../openapi/generated/layerzme/client', () => ({
  createClient: mockCreateClient,
}));

const SPARK_ADDRESS = 'spark1testaddress';

describe('formatLayerzLightningAddress', () => {
  it('appends @layerz.me', () => {
    expect(formatLayerzLightningAddress('alice')).toBe('alice@layerz.me');
    expect(formatLayerzLightningAddress(SPARK_ADDRESS)).toBe(`${SPARK_ADDRESS}@layerz.me`);
  });
});

describe('lookupLayerzLightningAddress', () => {
  beforeEach(() => {
    mockGetBySparkAddress.mockReset();
  });

  it('uses the registered username instead of the spark address', async () => {
    mockGetBySparkAddress.mockResolvedValueOnce({ data: { username: 'alice' } });

    const result = await lookupLayerzLightningAddress(SPARK_ADDRESS);

    expect(result.lightningAddress).toBe('alice@layerz.me');
    expect(result.username).toBe('alice');
    expect(result.claimed).toBe(true);
    expect(mockGetBySparkAddress).toHaveBeenCalledWith(expect.objectContaining({ path: { sparkAddress: SPARK_ADDRESS }, throwOnError: false }));
  });

  it('falls back to the spark address when no username is registered', async () => {
    mockGetBySparkAddress.mockResolvedValueOnce({ data: { status: 'not_found' } });

    const result = await lookupLayerzLightningAddress(SPARK_ADDRESS);

    expect(result.lightningAddress).toBe(`${SPARK_ADDRESS}@layerz.me`);
    expect(result.username).toBeNull();
    expect(result.claimed).toBe(false);
  });

  it('falls back when the lookup request fails', async () => {
    mockGetBySparkAddress.mockRejectedValueOnce(new Error('layerz.me 500'));

    const result = await lookupLayerzLightningAddress(SPARK_ADDRESS);

    expect(result.lightningAddress).toBe(`${SPARK_ADDRESS}@layerz.me`);
    expect(result.claimed).toBe(false);
  });
});

describe('resolveLayerzLightningAddress', () => {
  it('returns the lightningAddress field from lookup', async () => {
    mockGetBySparkAddress.mockResolvedValueOnce({ data: { username: 'bob' } });
    await expect(resolveLayerzLightningAddress(SPARK_ADDRESS)).resolves.toBe('bob@layerz.me');
  });
});

describe('claimLayerzLightningAddressUsername', () => {
  beforeEach(() => {
    mockGetByUsername.mockReset();
    mockPostUsers.mockReset();
  });

  it('rejects whitespace-only input before calling the API', async () => {
    const result = await claimLayerzLightningAddressUsername(SPARK_ADDRESS, '   ');

    expect(result).toEqual({ ok: false, reason: 'empty' });
    expect(mockGetByUsername).not.toHaveBeenCalled();
    expect(mockPostUsers).not.toHaveBeenCalled();
  });

  it('normalizes input and posts the spark address', async () => {
    mockGetByUsername.mockResolvedValueOnce({ data: { status: 'not_found' } });
    mockPostUsers.mockResolvedValueOnce({ data: { username: 'alice', sparkAddress: SPARK_ADDRESS } });

    const result = await claimLayerzLightningAddressUsername(SPARK_ADDRESS, '  Alice ');

    expect(result).toEqual({ ok: true, username: 'alice', lightningAddress: 'alice@layerz.me' });
    expect(mockGetByUsername).toHaveBeenCalledWith(expect.objectContaining({ path: { username: 'alice' } }));
    expect(mockPostUsers).toHaveBeenCalledWith(expect.objectContaining({ body: { username: 'alice', sparkAddress: SPARK_ADDRESS } }));
  });

  it('does not POST when the username is already taken', async () => {
    mockGetByUsername.mockResolvedValueOnce({ data: { username: 'alice', sparkAddress: 'spark1other' } });

    const result = await claimLayerzLightningAddressUsername(SPARK_ADDRESS, 'alice');

    expect(result).toEqual({ ok: false, reason: 'taken' });
    expect(mockPostUsers).not.toHaveBeenCalled();
  });

  it('treats a POST body without username as unconfirmed', async () => {
    mockGetByUsername.mockResolvedValueOnce({ data: { status: 'not_found' } });
    mockPostUsers.mockResolvedValueOnce({ data: { status: 'error', message: 'nope' } });

    const result = await claimLayerzLightningAddressUsername(SPARK_ADDRESS, 'alice');

    expect(result).toEqual({ ok: false, reason: 'unconfirmed' });
  });

  it('surfaces POST failures as api_error', async () => {
    mockGetByUsername.mockResolvedValueOnce({ data: { status: 'not_found' } });
    mockPostUsers.mockRejectedValueOnce(new Error('layerz.me unavailable'));

    const result = await claimLayerzLightningAddressUsername(SPARK_ADDRESS, 'alice');

    expect(result).toEqual({ ok: false, reason: 'api_error', message: 'layerz.me unavailable' });
  });
});
