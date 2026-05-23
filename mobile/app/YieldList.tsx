import React, { useCallback, useContext, useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import EarnBalanceSummary from '@/components/EarnBalanceSummary';
import RadialGradientScreen from '@/components/RadialGradientScreen';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import SectionContainer from '@/components/SectionContainer';
import { ThemedText } from '@/components/ThemedText';
import YieldRow from '@/components/YieldRow';
import { LayerzStorage } from '@/src/class/layerz-storage';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { getNetworkImageAsset } from '@/utils/networkAssets';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useSparkUsdbEarnMetrics } from '@shared/hooks/useSparkUsdbEarnMetrics';
import { useYieldDiscovery, YieldBearingCachedTokenInfo, YIELD_TOKEN_DEFINITIONS_BY_NETWORK } from '@shared/hooks/useYieldDiscovery';
import { getTokenInfo } from '@shared/models/token-list';
import { AssetId } from '@shared/types/asset';
import { NETWORK_BOTANIX, NETWORK_CITREA, NETWORK_SPARK, Networks } from '@shared/types/networks';
import { router } from 'expo-router';

const USDB_YIELD_TOKEN_ID = 'btkn1xgrvjwey5ngcagvap2dzzvsy4uk8ua9x69k82dwvt5e7ef9drm9qztux87';
/** Transfer screen: BTC-Spark → Spark USDB (Flashnet) */
const TRANSFER_TO_USDB: { sendAsset: AssetId; receiveAsset: AssetId } = {
  sendAsset: 'native:spark',
  receiveAsset: 'token:spark:usdb',
};

type YieldWithNetwork = YieldBearingCachedTokenInfo & { network: Networks };

const availableYields = (Object.entries(YIELD_TOKEN_DEFINITIONS_BY_NETWORK) as [Networks, { tokenId: string; apr: string; url: string }[]][]).flatMap(([network, definitions]) =>
  definitions.map((def) => ({ ...def, network, tokenInfo: getTokenInfo(def.tokenId) }))
);

export default function YieldListScreen() {
  const { network, setNetwork } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);

  const { yieldList: botanixYield } = useYieldDiscovery(NETWORK_BOTANIX, accountNumber, BackgroundExecutor, LayerzStorage);
  const { yieldList: citreaYield } = useYieldDiscovery(NETWORK_CITREA, accountNumber, BackgroundExecutor, LayerzStorage);
  const { yieldList: sparkYield } = useYieldDiscovery(NETWORK_SPARK, accountNumber, BackgroundExecutor, LayerzStorage);

  const { earnTotalUsd, rewards30dUsd, rewardsLifetimeUsd, isLoading: earnMetricsLoading } = useSparkUsdbEarnMetrics(accountNumber, BackgroundExecutor);

  const allYields = useMemo<YieldWithNetwork[]>(
    () => [
      ...botanixYield.map((y): YieldWithNetwork => ({ ...y, network: NETWORK_BOTANIX })),
      ...citreaYield.map((y): YieldWithNetwork => ({ ...y, network: NETWORK_CITREA })),
      ...sparkYield.map((y): YieldWithNetwork => ({ ...y, network: NETWORK_SPARK })),
    ],
    [botanixYield, citreaYield, sparkYield]
  );

  const [visibleAllocatedIds, setVisibleAllocatedIds] = useState<Set<string>>(new Set());

  const handleYieldVisible = useCallback((id: string) => {
    setVisibleAllocatedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const filteredAvailableYields = useMemo(() => availableYields.filter((def) => !visibleAllocatedIds.has(def.tokenId.toLowerCase())), [visibleAllocatedIds]);

  // Extract all possible yielding tokens into one flat array
  const allYieldTokens = Object.values(YIELD_TOKEN_DEFINITIONS_BY_NETWORK).flatMap((defs) => defs ?? []);

  const handleYieldPress = async (_token: YieldBearingCachedTokenInfo) => {
    switch (_token.id) {
      case '0xF4586028FFdA7Eca636864F80f8a3f2589E33795':
        // botanix yield
        setNetwork(NETWORK_BOTANIX);
        await new Promise((res) => setTimeout(res, 100)); // propagate network change
        router.push({ pathname: '/(tabs)/explorer', params: { url: 'https://yield.botanixlabs.com' } });
        break;
      case USDB_YIELD_TOKEN_ID:
        router.push({
          pathname: '/transfer',
          params: { sendAsset: TRANSFER_TO_USDB.sendAsset, receiveAsset: TRANSFER_TO_USDB.receiveAsset },
        });
        break;
    }
  };

  return (
    <RadialGradientScreen network={network} scroll={true}>
      <ScreenHeader title="Earn" />
      <View style={styles.list}>
        <EarnBalanceSummary earnTotalUsd={earnTotalUsd} rewards30dUsd={rewards30dUsd} rewardsLifetimeUsd={rewardsLifetimeUsd} isLoading={earnMetricsLoading} />
        <SectionContainer title="Allocated" contentStyle={styles.sectionRows}>
          {allYields.map((yieldToken) => (
            <YieldRow
              key={yieldToken.id}
              token={yieldToken}
              onPress={handleYieldPress}
              selected={false}
              network={yieldToken.network}
              onVisible={() => handleYieldVisible(yieldToken.id.toLowerCase())}
            />
          ))}
          {filteredAvailableYields.length === allYieldTokens.length && <ThemedText style={styles.noAllocatedYields}>Nothing allocated yet</ThemedText>}
        </SectionContainer>

        {filteredAvailableYields.length > 0 && (
          <SectionContainer title="Available" contentStyle={styles.sectionRows}>
            {filteredAvailableYields.map((def) => {
              const networkIcon = getNetworkImageAsset(def.network);
              return (
                <TouchableOpacity
                  key={`${def.network}-${def.tokenId}`}
                  style={styles.availableRow}
                  activeOpacity={0.7}
                  onPress={() => handleYieldPress({ ...def.tokenInfo, balance: undefined, yield: { tokenId: def.tokenId, apr: def.apr, url: def.url } })}
                >
                  <View style={styles.availableIcon}>{networkIcon && <Image source={networkIcon} style={styles.availableIconImage} contentFit="cover" />}</View>
                  <View style={styles.availableInfo}>
                    <ThemedText style={styles.availableName}>{def.tokenInfo.name}</ThemedText>
                    <View style={styles.availableAprRow}>
                      <ThemedText style={styles.aprPrefix}>APR:</ThemedText>
                      <ThemedText style={styles.aprValue}>{def.apr}</ThemedText>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </SectionContainer>
        )}
      </View>
    </RadialGradientScreen>
  );
}

const styles = StyleSheet.create({
  noAllocatedYields: {
    paddingLeft: 16,
  },
  list: {
    paddingTop: 16,
    paddingHorizontal: 16,
    gap: 16,
  },
  sectionRows: {
    gap: 16,
  },
  availableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  availableIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  availableIconImage: {
    width: '100%',
    height: '100%',
    borderRadius: 19,
  },
  availableInfo: {
    flex: 1,
  },
  availableName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
  availableAprRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  aprPrefix: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.3)',
    marginRight: 4,
  },
  aprValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#00ff6e',
  },
});
