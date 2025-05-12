import React, { useEffect, useState } from 'react';
import { createTamagui, TamaguiProvider } from 'tamagui';

type SimpleTamaguiProviderProps = {
  children: React.ReactNode;
};

// Create an ultra-minimal Tamagui configuration
// This is the simplest possible configuration that will work reliably
const simpleConfig = createTamagui({
  defaultTheme: 'light',
  tokens: {
    size: {
      0: 0,
      1: 4,
      2: 8,
      3: 16,
      4: 24,
      5: 32,
      6: 40,
    },
    space: {
      0: 0,
      1: 4,
      2: 8,
      3: 16,
      4: 24,
      5: 32,
      6: 40,
    },
    radius: {
      0: 0,
      1: 4,
      2: 8,
      3: 16,
    },
    color: {
      primary: '#011474',
      accent: '#FD5D2B',
      white: '#FFFFFF',
      black: '#000000',
      background: '#FFFFFF',
      backgroundDark: '#011474',
      text: '#000000',
      textDark: '#FFFFFF',
    },
  },
  themes: {
    light: {
      background: '#FFFFFF',
      color: '#000000',
    },
    dark: {
      background: '#011474',
      color: '#FFFFFF',
    },
  },
});

/**
 * Ultra robust Tamagui provider with multiple failsafe mechanisms
 * Uses a minimal configuration to avoid environment variable injection issues
 */
export function SimpleTamaguiProvider({ children }: SimpleTamaguiProviderProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [hasError, setHasError] = useState(false);
  const [forceRender, setForceRender] = useState(0);

  // Detect system theme
  useEffect(() => {
    try {
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
    } catch (e) {
      console.error('Error setting up theme detection:', e);
      // In case of error, just use light theme
    }
  }, []);

  // Automatic recovery attempt if initialization fails
  useEffect(() => {
    console.log('SimpleTamaguiProvider: Initialization attempt');

    // If we have an error, try to force a new render after a delay
    if (hasError && forceRender < 2) {
      const timer = setTimeout(() => {
        console.log('SimpleTamaguiProvider: Recovery attempt', forceRender + 1);
        setHasError(false);
        setForceRender((prev) => prev + 1);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [hasError, forceRender]);

  // When we've exhausted retries, or already have an error, just render children directly
  if (hasError || forceRender >= 2) {
    console.log('SimpleTamaguiProvider: Using direct render fallback');
    return <>{children}</>;
  }

  try {
    // Use the simple config that's fully defined in this file
    return (
      <TamaguiProvider config={simpleConfig} defaultTheme={theme}>
        {children}
      </TamaguiProvider>
    );
  } catch (error) {
    console.error('Error in SimpleTamaguiProvider:', error);
    setHasError(true);

    // Fallback to just rendering children directly
    return <>{children}</>;
  }
}
