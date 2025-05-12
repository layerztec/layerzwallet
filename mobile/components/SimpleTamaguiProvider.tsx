import React, { useState, useEffect } from 'react';
import { TamaguiProvider } from 'tamagui';
import type { TamaguiInternalConfig } from 'tamagui';

// Try multiple config options with fallbacks
let tamaguiConfig: TamaguiInternalConfig | undefined;
try {
  // First try the minimal config (most likely to work)
  tamaguiConfig = require('../tamagui.minimal').default;
  console.log('Using minimal tamagui config');
} catch (e) {
  console.warn('Failed to import minimal tamagui config, trying regular config:', e);
  try {
    // Fall back to regular config
    tamaguiConfig = require('../tamagui.config').default;
    console.log('Using regular tamagui config');
  } catch (e2) {
    console.warn('Failed to import any tamagui config:', e2);
    tamaguiConfig = undefined;
  }
}

type SimpleTamaguiProviderProps = {
  children: React.ReactNode;
};

/**
 * Ultra-robust SimpleTamaguiProvider with multiple failsafe mechanisms
 */
export const SimpleTamaguiProvider = ({ children }: SimpleTamaguiProviderProps) => {
  const [hasError, setHasError] = useState(false);
  const [forceRender, setForceRender] = useState(0);

  // Automatic recovery attempt
  useEffect(() => {
    console.log('SimpleTamaguiProvider: Initialization attempt');

    // If we have an error, try to force a new render after a delay
    if (hasError && forceRender < 3) {
      const timer = setTimeout(() => {
        console.log('SimpleTamaguiProvider: Recovery attempt', forceRender + 1);
        setHasError(false);
        setForceRender((prev) => prev + 1);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [hasError, forceRender]);

  // Force hide splash screen regardless of Tamagui state
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        // Attempt to import this dynamically to avoid issues
        const SplashScreen = require('expo-splash-screen');
        SplashScreen.hideAsync().catch(() => {});
      } catch (e) {
        console.error('Failed to dynamically import SplashScreen:', e);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // If we already know we have an error or no config, just render children directly
  if (hasError || !tamaguiConfig) {
    console.log('SimpleTamaguiProvider: Using direct render fallback');
    return <>{children}</>;
  }

  // Try to render with Tamagui with error boundaries
  try {
    return (
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        {children}
      </TamaguiProvider>
    );
  } catch (error) {
    console.error('Failed to initialize TamaguiProvider:', error);

    // Save the error state and use fallback
    setHasError(true);
    return <>{children}</>;
  }
};
