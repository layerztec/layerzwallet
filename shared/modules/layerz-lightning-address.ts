import { createClient } from '../openapi/generated/layerzme/client';
import { getApiUsersBySparkAddressBySparkAddress } from '../openapi/generated/layerzme';

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
