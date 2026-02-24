import React, { useContext, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import SectionContainer from '@/components/SectionContainer';
import { ThemedText } from '@/components/ThemedText';
import YieldRow from '@/components/YieldRow';
import { LayerzStorage } from '@/src/class/layerz-storage';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { getNetworkImageAsset } from '@/utils/networkAssets';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { useYieldDiscovery, YieldBearingCachedTokenInfo, YIELD_TOKEN_DEFINITIONS_BY_NETWORK } from '@shared/hooks/useYieldDiscovery';
import { globalDarkBackground } from '@shared/constants/Colors';
import { getTokenInfo } from '@shared/models/token-list';
import { NETWORK_BOTANIX, NETWORK_CITREA, NETWORK_SPARK, Networks } from '@shared/types/networks';

type YieldWithNetwork = YieldBearingCachedTokenInfo & { network: Networks };

const availableYields = (Object.entries(YIELD_TOKEN_DEFINITIONS_BY_NETWORK) as [Networks, { tokenId: string; apr: string; url: string }[]][]).flatMap(([network, definitions]) =>
  definitions.map((def) => ({ ...def, network, tokenInfo: getTokenInfo(def.tokenId) }))
);

export default function YieldListScreen() {
  const { accountNumber } = useContext(AccountNumberContext);

  const { yieldList: botanixYield } = useYieldDiscovery(NETWORK_BOTANIX, accountNumber, BackgroundExecutor, LayerzStorage);
  const { yieldList: citreaYield } = useYieldDiscovery(NETWORK_CITREA, accountNumber, BackgroundExecutor, LayerzStorage);
  const { yieldList: sparkYield } = useYieldDiscovery(NETWORK_SPARK, accountNumber, BackgroundExecutor, LayerzStorage);

  const allYields = useMemo<YieldWithNetwork[]>(
    () => [
      ...botanixYield.map((y): YieldWithNetwork => ({ ...y, network: NETWORK_BOTANIX })),
      ...citreaYield.map((y): YieldWithNetwork => ({ ...y, network: NETWORK_CITREA })),
      ...sparkYield.map((y): YieldWithNetwork => ({ ...y, network: NETWORK_SPARK })),
    ],
    [botanixYield, citreaYield, sparkYield]
  );

  const handleYieldPress = (_token: YieldBearingCachedTokenInfo) => {
    // TODO
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ScreenHeader title="Yield" />
        <ScrollView contentContainerStyle={styles.list}>
          <SectionContainer title="Allocated">
            {allYields.map((yieldToken) => (
              <YieldRow key={yieldToken.id} token={yieldToken} onPress={handleYieldPress} selected={false} network={yieldToken.network} />
            ))}
          </SectionContainer>

          <SectionContainer title="Available">
            {availableYields.map((def) => {
              const networkIcon = getNetworkImageAsset(def.network);
              return (
                <View key={`${def.network}-${def.tokenId}`} style={styles.availableRow}>
                  <View style={styles.availableIcon}>{networkIcon && <Image source={networkIcon} style={styles.availableIconImage} contentFit="cover" />}</View>
                  <View style={styles.availableInfo}>
                    <ThemedText style={styles.availableName}>{def.tokenInfo.name}</ThemedText>
                    <View style={styles.availableAprRow}>
                      <ThemedText style={styles.aprPrefix}>APR:</ThemedText>
                      <ThemedText style={styles.aprValue}>{def.apr}</ThemedText>
                    </View>
                  </View>
                </View>
              );
            })}
          </SectionContainer>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: globalDarkBackground,
  },
  safeArea: {
    flex: 1,
  },
  list: {
    paddingTop: 16,
    paddingHorizontal: 16,
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
