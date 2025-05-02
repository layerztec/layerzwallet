/**
 * Theme context and provider for the extension
 */

import React, { createContext, useContext } from 'react';
import { useTheme as useThemeBase } from './useThemeHook';

// Create the theme context
const ThemeContext = createContext<ReturnType<typeof useThemeBase>>({
  colorScheme: 'light',
  getColor: () => '#000000',
  isDarkMode: false,
});

// Provider component that wraps the app and makes theme available to all children
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useThemeBase();

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};

// Hook for easy theme consumption throughout the app
export const useTheme = () => useContext(ThemeContext);
