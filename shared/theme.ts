export const LayerzTheme = {
  colors: {
    primary: '#0a7ea4',
    secondary: '#34C759',
    accent: '#007AFF',
    danger: '#FF3B30',

    black: '#000000',
    darkGray: '#242424',
    mediumGray: '#687076',
    lightGray: '#9BA1A6',
    offWhite: '#f0f0f0',
    white: '#FFFFFF',

    bitcoin: '#F7931A',
    ethereum: '#627EEA',
    layer2: '#8A2BE2',

    success: '#34C759',
    warning: '#FFCC00',
    error: '#FF3B30',
    info: '#007AFF',
  },

  // Default fonts
  fonts: {
    regular: {
      fontFamily: 'System',
      fontWeight: 'normal' as 'normal',
    },
    medium: {
      fontFamily: 'System',
      fontWeight: '500' as '500',
    },
    bold: {
      fontFamily: 'System',
      fontWeight: 'bold' as 'bold',
    },
    heavy: {
      fontFamily: 'System',
      fontWeight: '800' as '800',
    },
  },

  light: {
    text: '#11181C',
    subtleText: '#687076',
    background: '#FFFFFF',
    card: '#FFFFFF',
    border: '#E1E3E5',
    notification: '#FF3B30',
    tint: '#0a7ea4',
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: '#0a7ea4',
    buttonBackground: '#f0f0f0',
    buttonText: '#11181C',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
  },

  dark: {
    text: '#ECEDEE',
    subtleText: '#9BA1A6',
    background: '#151718',
    card: '#242424',
    border: '#2A2F32',
    notification: '#FF453A',
    tint: '#FFFFFF',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#FFFFFF',
    buttonBackground: '#2A2F32',
    buttonText: '#ECEDEE',
    shadowColor: 'rgba(0, 0, 0, 0.3)',
  },
};

export type Theme = {
  dark: boolean;
  colors: {
    primary: string;
    background: string;
    card: string;
    text: string;
    border: string;
    notification: string;
    [key: string]: string;
  };
  fonts: {
    regular: {
      fontFamily: string;
      fontWeight: 'normal' | '400';
    };
    medium: {
      fontFamily: string;
      fontWeight: '500';
    };
    bold: {
      fontFamily: string;
      fontWeight: 'bold' | '700';
    };
    heavy: {
      fontFamily: string;
      fontWeight: '800' | '900';
    };
  };
};

export function createNavigationTheme(darkMode: boolean): Theme {
  const baseTheme = darkMode ? LayerzTheme.dark : LayerzTheme.light;
  const baseColors = LayerzTheme.colors;

  return {
    dark: darkMode,
    colors: {
      ...baseColors,
      ...baseTheme,
    },
    fonts: LayerzTheme.fonts,
  };
}

export const LayerzDarkTheme = createNavigationTheme(true);
export const LayerzLightTheme = createNavigationTheme(false);

export type ThemeColorNames = keyof typeof LayerzTheme.light & keyof typeof LayerzTheme.dark;
export type ColorNames = keyof typeof LayerzTheme.colors;
