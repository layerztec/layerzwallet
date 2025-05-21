// Web-compatible color scheme hook
import { useState, useEffect } from 'react';

type ColorScheme = 'light' | 'dark';

export function useColorScheme(): ColorScheme {
  // For non-web environments, default to 'light'
  return 'light';
}
