import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { Platform, DynamicColorIOS } from 'react-native';

export default function TabsLayout() {
  // Platform-aware color for label and tint
  const labelColor = Platform.OS === 'ios' 
    ? DynamicColorIOS({ dark: 'white', light: 'white' })
    : 'white';
  
  const tintColorValue = Platform.OS === 'ios'
    ? DynamicColorIOS({ dark: 'white', light: 'white' })
    : 'white';

  return (
    <NativeTabs
      labelStyle={{
        color: labelColor,
      }}
      tintColor={tintColorValue}
    >
      <NativeTabs.Trigger name="home">
        <Label>Layerz</Label>
        <Icon sf="house.fill" src={require('@/assets/images/ui/layerz.png')} drawable="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="swaps">
        <Label>Swaps</Label>
        <Icon sf="arrow.triangle.2.circlepath" src={require('@/assets/images/ui/swap.png')} drawable="swap_horiz" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="explorer">
        <Label>Explorer</Label>
        <Icon sf="globe" src={require('@/assets/images/ui/explorer.png')} drawable="public" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
