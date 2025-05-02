/**
 * Extension implementation of the shared theme hook
 */
import { createTheme, ThemeMode } from '@shared/hooks/useThemeHook';

/**
 * Detect color scheme for Chrome extension
 */
function getExtensionColorScheme(): ThemeMode {
  // Check if media query for dark mode matches
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

  // Check if user has a theme preference stored in local storage
  const storedTheme = localStorage.getItem('layerzwallet-theme');
  if (storedTheme === 'dark' || storedTheme === 'light') {
    return storedTheme as ThemeMode;
  }

  // Use system preference as fallback
  return isDarkMode ? 'dark' : 'light';
}

// Create theme hook using the platform-specific color scheme detector
export const useTheme = createTheme(getExtensionColorScheme);
