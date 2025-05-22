import { Colors } from '@shared/constants/Colors';
import { useEffect, useState } from 'react';

function getInitialTheme() {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export function useThemeColor(props: { light?: string; dark?: string }, colorName: keyof typeof Colors.light & keyof typeof Colors.dark) {
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const colorFromProps = props[theme];
  if (colorFromProps) {
    return colorFromProps;
  }

  return Colors[theme][colorName];
}
