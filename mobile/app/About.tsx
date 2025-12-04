import * as Application from 'expo-application';
import { Stack, useRouter } from 'expo-router';
import React, { useContext } from 'react';
import { SectionList, SectionListData, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildScreenHeaderOptions } from '@/components/navigation/ScreenHeader';
import { ThemedText } from '@/components/ThemedText';
import SettingsRow from '@/components/SettingsRow';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getGradientColors } from '@/utils/gradientUtils';
import * as Linking from 'expo-linking';

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

export default function AboutScreen() {
  const router = useRouter();
  const { network } = useContext(NetworkContext);
  const insets = useSafeAreaInsets();

  const handleBlogPress = async () => {
    await Linking.openURL('https://layerzwallet.com/blog');
  };

  const handleTermsPress = async () => {
    await Linking.openURL('https://layerzwallet.com/tos');
  };

  const handlePrivacyPress = async () => {
    await Linking.openURL('https://layerzwallet.com/privacy');
  };

  const handleChangelogPress = () => {
    router.push('/Changelog');
  };

  const gradientColors = getGradientColors(network);
  const backgroundColor = gradientColors[0];

  const sections: SettingsSection[] = [
    {
      title: '',
      key: 'resources',
      hasBackground: true,
      data: [
        {
          id: 'blog',
          title: 'Blog',
          onPress: handleBlogPress,
          hideChevron: true,
        },
        {
          id: 'terms',
          title: 'Terms of Service',
          onPress: handleTermsPress,
          hideChevron: true,
        },
        {
          id: 'privacy',
          title: 'Privacy Policy',
          onPress: handlePrivacyPress,
          hideChevron: true,
        },
        {
          id: 'changelog',
          title: 'Changelog',
          onPress: handleChangelogPress,
        },
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
        <Stack.Screen options={buildScreenHeaderOptions({ title: 'About' })} />

        <View style={styles.sectionListContainer}>
          <SectionList<SettingsItem, SettingsSection>
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={() => null}
            renderSectionHeader={renderSectionHeader}
            renderSectionFooter={renderSectionFooter}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 16 + insets.bottom }]}
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
