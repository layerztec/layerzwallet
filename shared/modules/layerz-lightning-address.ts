import { getApiUsersBySparkAddressBySparkAddress, getApiUsersByUsername, postApiUsers } from '../openapi/generated/layerzme';
import { createClient } from '../openapi/generated/layerzme/client';

export const LAYERZ_ME_DOMAIN = 'layerz.me';
const LAYERZ_ME_BASE_URL = 'https://layerz.me';

let layerzMeClient: ReturnType<typeof createClient> | undefined;

function getLayerzMeClient() {
  layerzMeClient ??= createClient({ baseUrl: LAYERZ_ME_BASE_URL });
  return layerzMeClient;
}

export type LayerzLightningAddressLookup = {
  lightningAddress: string;
  username: string | null;
  claimed: boolean;
};

export type ClaimLayerzUsernameFailureReason = 'empty' | 'taken' | 'unconfirmed' | 'api_error';

export type ClaimLayerzUsernameResult = { ok: true; username: string; lightningAddress: string } | { ok: false; reason: ClaimLayerzUsernameFailureReason; message?: string };

export function formatLayerzLightningAddress(localPart: string): string {
  return `${localPart}@${LAYERZ_ME_DOMAIN}`;
}

/** Looks up a claimed username; falls back to `<spark-address>@layerz.me`. */
export async function lookupLayerzLightningAddress(sparkAddress: string): Promise<LayerzLightningAddressLookup> {
  let username: string | null = null;
  try {
    const { data } = await getApiUsersBySparkAddressBySparkAddress({
      client: getLayerzMeClient(),
      path: { sparkAddress },
      responseStyle: 'fields',
      throwOnError: false,
    });
    if (data?.username) username = data.username;
  } catch {
    // The default `<spark-address>@layerz.me` is always valid.
  }

  return {
    lightningAddress: formatLayerzLightningAddress(username ?? sparkAddress),
    username,
    claimed: username !== null,
  };
}

/** Returns the wallet's Layerz Lightning Address (claimed username or spark-address fallback). */
export async function resolveLayerzLightningAddress(sparkAddress: string): Promise<string> {
  return (await lookupLayerzLightningAddress(sparkAddress)).lightningAddress;
}

/** Registers a human-readable username for a Spark address on layerz.me. */
export async function claimLayerzLightningAddressUsername(sparkAddress: string, usernameRaw: string): Promise<ClaimLayerzUsernameResult> {
  const username = usernameRaw.trim().toLowerCase();
  if (!username) {
    return { ok: false, reason: 'empty' };
  }

  const { data: existing } = await getApiUsersByUsername({
    client: getLayerzMeClient(),
    path: { username },
    responseStyle: 'fields',
    throwOnError: false,
  });
  if (existing?.username) {
    return { ok: false, reason: 'taken' };
  }

  try {
    const { data: claim } = await postApiUsers({
      client: getLayerzMeClient(),
      body: { username, sparkAddress },
      responseStyle: 'fields',
      throwOnError: true,
    });
    if (!claim?.username) {
      return { ok: false, reason: 'unconfirmed' };
    }
    return {
      ok: true,
      username: claim.username,
      lightningAddress: formatLayerzLightningAddress(claim.username),
    };
  } catch (e) {
    return {
      ok: false,
      reason: 'api_error',
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
