import { AllNetworkInfos } from './all-network-infos';
import { getTokenInfo, USDT_TOKENS } from './token-list';
import { NETWORK_BITCOIN, NETWORK_BOTANIX_TESTNET, NETWORK_LIQUID, NETWORK_LIQUID_TESTNET, NETWORK_ROOTSTOCK, NETWORK_SPARK, Networks } from '../types/networks';
import { ASSET_IDS, AssetId, AssetInfo } from '../types/asset';

const ASSET_ID_SET = new Set<string>(ASSET_IDS);

export function isAssetId(value: string): value is AssetId {
  return ASSET_ID_SET.has(value);
}

/** Validate a string as a supported AssetId. Returns undefined if invalid. */
export function toAssetId(value: string | undefined | null): AssetId | undefined {
  if (!value) return undefined;
  return isAssetId(value) ? value : undefined;
}

function getNativeName(network: Networks): string {
  const displayName = AllNetworkInfos[network].displayName;
  const ticker = AllNetworkInfos[network].ticker;

  if (network === NETWORK_BITCOIN) return 'Bitcoin';
  if (network === NETWORK_LIQUID || network === NETWORK_LIQUID_TESTNET) return 'Liquid Bitcoin';
  if (network === NETWORK_BOTANIX_TESTNET) return 'Botanix BTC';
  if (ticker.includes('BTC')) return `${displayName} BTC`;

  return `${displayName} ${ticker}`;
}

function resolveTokenId(network: Networks, tokenRef: string): string {
  if (tokenRef === 'usdt' && network === NETWORK_LIQUID) {
    return USDT_TOKENS[NETWORK_LIQUID][0];
  }
  if (tokenRef === 'usdb' && network === NETWORK_SPARK) {
    return USDT_TOKENS[NETWORK_SPARK][0];
  }
  if (tokenRef === 'usdt0' && network === NETWORK_ROOTSTOCK) {
    return '0x779dED0C9e1022225F8e0630b35A9B54Be713736';
  }
  return tokenRef;
}

export function getAssetInfo(assetId: AssetId): AssetInfo {
  const [kind, networkRaw, tokenRef] = assetId.split(':');
  const network = networkRaw as Networks;
  const networkInfo = AllNetworkInfos[network];

  if (!networkInfo) {
    throw new Error(`Unknown network in asset id: ${assetId}`);
  }

  if (kind === 'native') {
    return {
      id: assetId,
      network,
      name: getNativeName(network),
      ticker: networkInfo.ticker,
      decimals: networkInfo.decimals,
      networkDisplayName: networkInfo.displayName,
    };
  }

  if (kind === 'token' && tokenRef) {
    const tokenId = resolveTokenId(network, tokenRef);
    const token = getTokenInfo(tokenId);

    return {
      id: assetId,
      network,
      name: token.name,
      ticker: token.symbol,
      decimals: token.decimals,
      tokenId,
      networkDisplayName: networkInfo.displayName,
    };
  }

  throw new Error(`Invalid asset id: ${assetId}`);
}
