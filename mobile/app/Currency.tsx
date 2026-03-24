import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';

import ScreenHeader from '@/components/navigation/ScreenHeader';
import SettingsRow from '@/components/SettingsRow';
import { globalDarkBackground } from '@shared/constants/Colors';
import { useSettings } from '@shared/hooks/useSettings';
import { SUPPORTED_FIAT_CURRENCIES, TFiat } from '@shared/types/fiat';

const CURRENCY_OPTIONS = SUPPORTED_FIAT_CURRENCIES;

export default function CurrencyScreen() {
  const { settings, updateSetting } = useSettings();
  const selectedCurrency = settings.currency;

  return (
    <View style={[styles.container, { backgroundColor: globalDarkBackground }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ScreenHeader title="Currency" testID="CurrencyScreenTitle" />

        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator>
          <View style={styles.settingsGroup}>
            {CURRENCY_OPTIONS.map((item: TFiat, index: number) => {
              const isSelected = selectedCurrency === item;
              const isLastItem = index === CURRENCY_OPTIONS.length - 1;

              return (
                <View key={item}>
                  <View style={styles.rowContainer}>
                    <View style={styles.rowContent}>
                      <SettingsRow title={item} onPress={() => updateSetting('currency', item)} hideChevron testID={`CurrencyOption-${item}`} />
                    </View>
                    {isSelected && (
                      <View style={styles.selectedIconContainer}>
                        <Ionicons name="checkmark-circle" size={20} color="white" />
                      </View>
                    )}
                  </View>
                  {!isLastItem && <View style={styles.divider} />}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 0,
  },
  settingsGroup: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowContent: {
    flex: 1,
  },
  selectedIconContainer: {
    marginRight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginLeft: 16,
  },
});
