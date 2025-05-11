import React, { useEffect, useState } from 'react';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../shared/constants/tamaguiTheme';

type TamaguiProviderWrapperProps = {
  children: React.ReactNode;
};

export function TamaguiProviderWrapper({ children }: TamaguiProviderWrapperProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Detect system theme for the extension
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const updateTheme = (event: MediaQueryListEvent | MediaQueryList) => {
      setTheme(event.matches ? 'dark' : 'light');
    };

    // Set initial theme
    updateTheme(mediaQuery);

    // Listen for theme changes
    mediaQuery.addEventListener('change', updateTheme);

    return () => {
      mediaQuery.removeEventListener('change', updateTheme);
    };
  }, []);

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={theme}>
      {children}
    </TamaguiProvider>
  );
}
