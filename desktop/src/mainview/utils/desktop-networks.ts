import { NETWORK_ARK, NETWORK_ARK_MUTINYNET, Networks } from '@shared/types/networks';

/** Ark networks not supported on desktop. */
export const DESKTOP_OMITTED_NETWORKS: ReadonlySet<Networks> = new Set([NETWORK_ARK, NETWORK_ARK_MUTINYNET]);

export function isDesktopOmittedNetwork(network: Networks): boolean {
  return DESKTOP_OMITTED_NETWORKS.has(network);
}
