import * as Application from 'expo-application';
import { useRouter } from 'expo-router';
import React, { useContext, useEffect, useState } from 'react';
import { Alert, SectionList, SectionListData, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import { ThemedText } from '@/components/ThemedText';
import SettingsRow from '@/components/SettingsRow';
import { LayerzStorage } from '@/src/class/layerz-storage';
import { useAuthState } from '@/src/hooks/AuthStateContext';
import { useBiometrics } from '@/hooks/useBiometrics';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useSettings } from '@shared/hooks/useSettings';
import { getGradientColors } from '@/utils/gradientUtils';

const gitCommitHash = require('../git_commit_hash.json');

// Types for settings items and sections
interface SettingsItem {
  id: string;
  title: string;
  onPress: () => void;
  hideChevron?: boolean;
  testID?: string;
  renderAccessory?: () => React.ReactElement | null;
}

interface SettingsSection extends SectionListData<SettingsItem> {
  title: string;
  key: string;
  hasBackground: boolean;
  data: SettingsItem[];
}

export default function SettingsScreen() {
  const router = useRouter();
  const { settings } = useSettings();
  const { network } = useContext(NetworkContext);
  const biometricInfo = useBiometrics();
  const { enableBiometricAuth, disableBiometricAuth } = useAuthState();
  const [seedBackedUp, setSeedBackedUp] = useState(false);

  // Check if seed is backed up (you might want to implement actual logic)
  useEffect(() => {
    (async () => {
      // Check if user has already backed up their seed
      // This is a placeholder - implement actual backup tracking logic
      const hasBackedUp = await LayerzStorage.getItem('SEED_BACKED_UP');
      setSeedBackedUp(hasBackedUp === 'true');
    })();
  }, []);

  const handleRecoveryPhrasePress = () => {
    router.push('/SeedBackup');
  };

  const handleBiometricsPress = async () => {
    if (!biometricInfo.isAvailable) {
      Alert.alert('Not Available', 'Biometric authentication is not available on this device.');
      return;
    }

    const currentValue = settings.biometricAuth;
    if (currentValue === 'ON') {
      Alert.alert('Disable Biometrics', 'Are you sure you want to disable biometric authentication?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async () => {
            await disableBiometricAuth();
          },
        },
      ]);
    } else {
      await enableBiometricAuth();
    }
  };

  const handlePasswordPress = () => {
    router.push('/onboarding/create-password');
  };

  const handleToolsPress = () => {
    router.push('/Tools');
  };

  const handleSupportPress = () => {
    Alert.alert('Support', 'Support options coming soon!');
  };

  const handleAboutPress = () => {
    router.push('/About');
  };

  const gradientColors = getGradientColors(network);
  const backgroundColor = gradientColors[0];

  const isBiometricsEnabled = settings.biometricAuth === 'ON';
  const isPasswordSet = settings.seedEncrypted === 'ON';

  const sections: SettingsSection[] = [
    {
      title: 'Your Wallet',
      key: 'wallet',
      hasBackground: true,
      data: [
        {
          id: 'recovery',
          title: 'Recovery Phrase',
          onPress: handleRecoveryPhrasePress,
          renderAccessory: () => (
            <View style={styles.statusBadgeContainer}>
              {seedBackedUp ? (
                <View style={[styles.badge, styles.badgeSuccess]}>
                  <Ionicons name="checkmark" size={12} color="white" />
                  <ThemedText style={styles.badgeText}>backup</ThemedText>
                </View>
              ) : (
                <View style={[styles.badge, styles.badgeWarning]}>
                  <Ionicons name="close" size={12} color="black" />
                  <ThemedText style={styles.badgeText}>backup</ThemedText>
                </View>
              )}
            </View>
          ),
        },
      ],
    },
    {
      title: 'Security',
      key: 'security',
      hasBackground: true,
      data: [
        {
          id: 'biometrics',
          title: 'Biometrics',
          onPress: handleBiometricsPress,
          hideChevron: isBiometricsEnabled,
          renderAccessory: () =>
            isBiometricsEnabled ? (
              <View style={styles.statusCheckContainer}>
                <Ionicons name="checkmark" size={20} color="white" />
              </View>
            ) : null,
        },
        {
          id: 'password',
          title: 'Password',
          onPress: handlePasswordPress,
          hideChevron: isPasswordSet,
          renderAccessory: () =>
            isPasswordSet ? (
              <View style={styles.statusCheckContainer}>
                <Ionicons name="checkmark" size={20} color="white" />
              </View>
            ) : null,
        },
      ],
    },
    {
      title: 'Options',
      key: 'options',
      hasBackground: false,
      data: [
        { id: 'tools', title: 'Tools', onPress: handleToolsPress, testID: 'ToolsButton' },
        { id: 'support', title: 'Support', onPress: handleSupportPress },
        { id: 'about', title: 'About', onPress: handleAboutPress },
      ],
    },
  ];

  const renderSectionHeader = ({ section }: { section: SettingsSection }) => <ThemedText style={styles.sectionHeader}>{section.title}</ThemedText>;

  const renderSectionFooter = ({ section }: { section: SettingsSection }) => {
    return (
      <View style={[styles.settingsGroup, !section.hasBackground && styles.settingsGroupTransparent]}>
        {section.data.map((item: SettingsItem, index: number) => {
          const isLastItem = index === section.data.length - 1;
          return (
            <View key={item.id}>
              <View style={styles.rowContainer}>
                <View style={styles.rowContent}>
                  <SettingsRow title={item.title} onPress={item.onPress} hideChevron={item.hideChevron} testID={item.testID} />
                </View>
                {item.renderAccessory && item.renderAccessory()}
              </View>
              {!isLastItem && <View style={styles.divider} />}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ScreenHeader title="Settings" testID="SettingsScreenTitle" />

        <View style={styles.sectionListContainer}>
          <SectionList<SettingsItem, SettingsSection>
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={() => null}
            renderSectionHeader={renderSectionHeader}
            renderSectionFooter={renderSectionFooter}
            contentContainerStyle={styles.scrollContent}
            stickySectionHeadersEnabled={false}
            style={styles.scrollContainer}
          />

          <View style={styles.versionContainer}>
            <ThemedText style={styles.versionText}>
              {Application.applicationName} v{Application.nativeApplicationVersion}
            </ThemedText>
            <ThemedText style={styles.buildText}>(build {Application.nativeBuildVersion})</ThemedText>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 8,
    marginTop: 16,
    marginLeft: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingsGroup: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  settingsGroupTransparent: {
    backgroundColor: 'transparent',
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowContent: {
    flex: 1,
  },
  statusBadgeContainer: {
    marginRight: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeSuccess: {
    backgroundColor: 'white',
  },
  badgeWarning: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'black',
  },
  statusCheckContainer: {
    marginRight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginLeft: 16,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingBottom: 8,
  },
  versionText: {
    fontSize: 13,
    color: 'white',
    textAlign: 'center',
  },
  buildText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
    marginTop: 2,
  },
  sectionListContainer: {
    flex: 1,
  },
});
