/**
 * Shared theme hook implementation to be extended by platform-specific versions
 */

export type ThemeMode = 'light' | 'dark';

// Common color palette for use across platforms
export interface ThemeColors {
  // Base colors
  background: string;
  text: string;
  border: string;
  primary: string;
  accent: string;
  error: string;
  success: string;
  warning: string;
  info: string;

  // UI element colors
  surfaceBackground: string;
  sendButton: string;
  receiveButton: string;
  icon: string;
  settingsIcon: string;
  white: string;
  black: string;

  // Network colors
  networkButtonText: string;
  selectedNetworkBackground: string;
  selectedNetworkText: string;

  // Other
  [key: string]: string | undefined;
}

// Color scheme definition (light/dark)
export interface ColorScheme {
  lightColor: string;
  darkColor: string;
}

// Create the theme hook with platform-specific color scheme detection
export function createTheme(getColorScheme: () => ThemeMode) {
  // Base implementation of the theme hook
  return function useTheme() {
    const colorScheme = getColorScheme();

    // Get color based on theme
    const getColor = (colorNameOrScheme: string | ColorScheme): string => {
      if (typeof colorNameOrScheme === 'string') {
        // Single color name provided
        switch (colorNameOrScheme) {
          // Base colors
          case 'background':
            return colorScheme === 'dark' ? '#121212' : '#FFFFFF';
          case 'text':
            return colorScheme === 'dark' ? '#E1E1E1' : '#121212';
          case 'border':
            return colorScheme === 'dark' ? '#333333' : '#E0E0E0';
          case 'primary':
            return '#1976D2'; // Same in both themes
          case 'accent':
            return '#FF4081'; // Same in both themes
          case 'error':
            return '#F44336'; // Same in both themes
          case 'success':
            return '#4CAF50'; // Same in both themes
          case 'warning':
            return '#FF9800'; // Same in both themes
          case 'info':
            return '#2196F3'; // Same in both themes

          // UI element colors
          case 'surfaceBackground':
            return colorScheme === 'dark' ? '#1E1E1E' : '#F5F5F5';
          case 'sendButton':
            return '#FF4336'; // Same in both themes
          case 'receiveButton':
            return '#4CAF50'; // Same in both themes
          case 'icon':
            return colorScheme === 'dark' ? '#C0C0C0' : '#6E6E6E';
          case 'settingsIcon':
            return colorScheme === 'dark' ? '#BBBBBB' : '#555555';
          case 'white':
            return '#FFFFFF'; // Same in both themes
          case 'black':
            return '#000000'; // Same in both themes

          // Network colors
          case 'networkButtonText':
            return colorScheme === 'dark' ? '#B0B0B0' : '#505050';
          case 'selectedNetworkBackground':
            return '#1976D2'; // Same in both themes
          case 'selectedNetworkText':
            return '#FFFFFF'; // Same in both themes

          default:
            console.warn(`Color "${colorNameOrScheme}" not found in theme`);
            return colorScheme === 'dark' ? '#FFFFFF' : '#000000';
        }
      } else {
        // ColorScheme object provided with light/dark options
        return colorScheme === 'dark' ? colorNameOrScheme.darkColor : colorNameOrScheme.lightColor;
      }
    };

    return {
      colorScheme,
      getColor,
      isDarkMode: colorScheme === 'dark',
    };
  };
}
