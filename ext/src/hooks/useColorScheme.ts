/**
 * Hook to detect and manage color scheme preferences in the extension
 */

import { useEffect, useState } from 'react';

// Color scheme type
export type ColorSchemeType = 'light' | 'dark';

/**
 * Hook that detects the user's preferred color scheme
 * For browser extensions, we detect the preferred scheme via window.matchMedia
 * and listen for changes
 */
export function useColorScheme(): ColorSchemeType {
  const [colorScheme, setColorScheme] = useState<ColorSchemeType>('dark');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    setColorScheme(darkModeMediaQuery.matches ? 'dark' : 'light');

    const listener = (event: MediaQueryListEvent) => {
      setColorScheme(event.matches ? 'dark' : 'light');
    };

    darkModeMediaQuery.addEventListener('change', listener);

    return () => {
      darkModeMediaQuery.removeEventListener('change', listener);
    };
  }, []);

  return colorScheme;
}
