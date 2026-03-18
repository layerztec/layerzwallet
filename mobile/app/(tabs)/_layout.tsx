import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { Tabs } from 'expo-router';
import { Image } from 'expo-image';
import { Platform, StyleSheet } from 'react-native';

import CustomTabBarBackground from '@/components/ui/CustomTabBarBackground';

// Use custom tab bar only on iOS 18–25 for a reliable background. iOS 26+ and Android use native tabs.
const iosVersion = Platform.OS === 'ios' ? (typeof Platform.Version === 'string' ? parseInt(String(Platform.Version), 10) : Number(Platform.Version)) : 0;
const useCustomTabBar = Platform.OS === 'ios' && iosVersion >= 18 && iosVersion < 26;

export default function TabsLayout() {
  if (!useCustomTabBar) {
    return (
      <NativeTabs
        backgroundColor={Platform.OS === 'android' ? '#111111' : undefined}
        iconColor="white"
        indicatorColor={Platform.OS === 'android' ? 'rgba(255, 255, 255, 0.1)' : undefined}
        labelStyle={{ color: 'white' }}
        tintColor="white"
      >
        <NativeTabs.Trigger name="home">
          <Label>Layerz</Label>
          <Icon sf="house.fill" src={require('@/assets/images/ui/layerz.png')} drawable="home" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="swaps">
          <Label>Transfer</Label>
          <Icon sf="arrow.triangle.2.circlepath" src={require('@/assets/images/ui/swap.png')} drawable="swap_horiz" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="explorer">
          <Label>Explorer</Label>
          <Icon sf="globe" src={require('@/assets/images/ui/explorer.png')} drawable="public" />
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.tabBar, { backgroundColor: 'transparent' }],
        tabBarActiveTintColor: 'white',
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.6)',
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarBackground: () => <CustomTabBarBackground />,
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen
        name="home"
        options={{
          title: 'Layerz',
          tabBarIcon: ({ size }) => <Image source={require('@/assets/images/ui/layerz.png')} style={{ width: size, height: size }} contentFit="contain" />,
          tabBarButtonTestID: 'Tab-home',
          tabBarAccessibilityLabel: 'Tab-home',
        }}
      />
      <Tabs.Screen
        name="swaps"
        options={{
          title: 'Transfer',
          tabBarIcon: ({ size }) => <Image source={require('@/assets/images/ui/swap.png')} style={{ width: size, height: size }} contentFit="contain" />,
          tabBarButtonTestID: 'Tab-swaps',
          tabBarAccessibilityLabel: 'Tab-swaps',
        }}
      />
      <Tabs.Screen
        name="explorer"
        options={{
          title: 'Explorer',
          tabBarIcon: ({ size }) => <Image source={require('@/assets/images/ui/explorer.png')} style={{ width: size, height: size }} contentFit="contain" />,
          tabBarButtonTestID: 'Tab-explorer',
          tabBarAccessibilityLabel: 'Tab-explorer',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    borderTopWidth: 0,
    elevation: 0,
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
});
