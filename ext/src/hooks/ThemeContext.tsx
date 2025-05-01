/**
 * Theme context and provider for the extension
 * This provides theme values to all components in the tree
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { useTheme as useLayerzTheme } from './useTheme';
import { Theme, ThemeColorNames, ColorNames } from '@shared/theme';

type ThemeContextType = {
  theme: Theme;
  isDark: boolean;
  colors: Record<string, string>;
  getColor: (colorName: ThemeColorNames | ColorNames) => string;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const themeValues = useLayerzTheme();

  return <ThemeContext.Provider value={themeValues}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
}
