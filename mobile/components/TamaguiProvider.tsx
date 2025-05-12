import React, { useEffect, useState } from 'react';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../shared/constants/tamaguiTheme';
import { useColorScheme, Text } from 'react-native';

type TamaguiProviderWrapperProps = {
  children: React.ReactNode;
  fontsLoaded?: boolean;
};

export function TamaguiProviderWrapper({ children, fontsLoaded = true }: TamaguiProviderWrapperProps) {
  const colorScheme = useColorScheme();
  const [isReady, setIsReady] = useState(false);

  // Make sure we don't initialize Tamagui until we're sure the environment is ready
  useEffect(() => {
    if (fontsLoaded) {
      setIsReady(true);
    }
  }, [fontsLoaded]);

  if (!isReady) {
    // Return a placeholder while fonts are loading
    return <Text>Loading...</Text>;
  }

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={colorScheme === 'dark' ? 'dark' : 'light'} disableInjectCSS>
      {children}
    </TamaguiProvider>
  );
}
