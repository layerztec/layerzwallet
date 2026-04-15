import { useMemo } from 'react';

import { useTokenDiscovery } from './useTokenDiscovery';
import { IBackgroundCaller } from '../types/IBackgroundCaller';
import { IStorage } from '../types/IStorage';
import { NETWORK_BOTANIX, NETWORK_SPARK, Networks } from '../types/networks';
import { CachedTokenInfo } from '@shared/types/token-info';

type YieldTokenDefinition = {
  tokenId: string;
  apr: string;
  url: string;
};

export interface YieldBearingCachedTokenInfo extends CachedTokenInfo {
  yield: YieldTokenDefinition;
}

export const YIELD_TOKEN_DEFINITIONS_BY_NETWORK: Partial<Record<Networks, YieldTokenDefinition[]>> = {
  [NETWORK_SPARK]: [{ tokenId: 'btkn1xgrvjwey5ngcagvap2dzzvsy4uk8ua9x69k82dwvt5e7ef9drm9qztux87', apr: '3.5 - 6% in BTC', url: 'https://docs.flashnet.xyz/usdb/overview' }],
  [NETWORK_BOTANIX]: [{ tokenId: '0xf4586028ffda7eca636864f80f8a3f2589e33795', apr: '2.59%', url: 'https://yield.botanixlabs.com' }],
  /*   [NETWORK_CITREA]: [
    { tokenId: '0x01465912c8cec266237050f429fe1b88daa56c0a', apr: '?', url: 'https://zentra.finance/earn' },
    { tokenId: '0x21edc56532b6e92e676aa260b2a1f968b20eb1f5', apr: '?', url: 'https://zentra.finance/earn' },
  ], */
};

export function useYieldDiscovery(network: Networks, accountNumber: number, backgroundCaller: IBackgroundCaller, storage: IStorage, refreshInterval = 5_000) {
  const { tokenList, isLoading, error, mutate } = useTokenDiscovery(network, accountNumber, backgroundCaller, storage, refreshInterval);

  const yieldList: YieldBearingCachedTokenInfo[] = useMemo(() => {
    const yieldTokenDefinitions = YIELD_TOKEN_DEFINITIONS_BY_NETWORK[network] ?? [];
    if (yieldTokenDefinitions.length === 0) return [];

    const yieldDefinitionByTokenId = new Map(yieldTokenDefinitions.map((definition) => [definition.tokenId.toLowerCase(), definition]));

    return (tokenList ?? []).flatMap((token) => {
      const yieldDefinition = yieldDefinitionByTokenId.get(token.id.toLowerCase());
      if (!yieldDefinition) return [];
      return [{ ...token, yield: yieldDefinition }];
    });
  }, [network, tokenList]);

  return {
    yieldList,
    isLoading,
    error,
    mutate,
  };
}
