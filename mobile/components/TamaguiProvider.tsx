import React from 'react';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../shared/constants/tamaguiTheme';
import { useColorScheme } from 'react-native';

type TamaguiProviderWrapperProps = {
  children: React.ReactNode;
};

export function TamaguiProviderWrapper({ children }: TamaguiProviderWrapperProps) {
  const colorScheme = useColorScheme();

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={colorScheme === 'dark' ? 'dark' : 'light'}>
      {children}
    </TamaguiProvider>
  );
}
