import { Stack } from 'expo-router';

export default function ManualBackupLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitle: '',
        headerTintColor: '#fff',
        headerBackButtonDisplayMode: 'minimal',
        headerTransparent: true,
        headerBackImageSource: require('@/assets/images/ui/headerBackImage.png'),
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        animationDuration: 350,
      }}
    >
      <Stack.Screen name="intro" />
      <Stack.Screen name="validation-intro" />
    </Stack>
  );
}
