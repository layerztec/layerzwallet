import { LayerzColors, getCurrentTheme } from '../pages/Popup/theme';

/**
 * Applies the current theme colors to CSS variables
 * This ensures that all CSS files can access the theme colors
 */
export function applyThemeToCSS(): void {
  const theme = getCurrentTheme();
  const colors = LayerzColors[theme];

  // Set CSS variables on the :root element
  const root = document.documentElement;

  // Apply base colors
  root.style.setProperty('--layerz-primary', colors.primary);
  root.style.setProperty('--layerz-primary-light', colors.primaryLight);
  root.style.setProperty('--layerz-primary-dark', colors.primaryDark);
  root.style.setProperty('--layerz-secondary', colors.secondary);
  root.style.setProperty('--layerz-accent', colors.accent);

  // Apply status colors
  root.style.setProperty('--layerz-success', colors.success);
  root.style.setProperty('--layerz-warning', colors.warning);
  root.style.setProperty('--layerz-error', colors.error);
  root.style.setProperty('--layerz-info', colors.info);

  // Apply UI colors
  root.style.setProperty('--layerz-text', colors.text);
  root.style.setProperty('--layerz-text-secondary', colors.textSecondary);
  root.style.setProperty('--layerz-text-tertiary', colors.textTertiary);
  root.style.setProperty('--layerz-background', colors.background);
  root.style.setProperty('--layerz-surface-background', colors.surfaceBackground);
  root.style.setProperty('--layerz-card-background', colors.cardBackground);
  root.style.setProperty('--layerz-border', colors.border);
  root.style.setProperty('--layerz-border-light', colors.borderLight);

  // Apply network colors
  root.style.setProperty('--layerz-selected-network-background', colors.selectedNetworkBackground);
  root.style.setProperty('--layerz-selected-network-text', colors.selectedNetworkText);
  root.style.setProperty('--layerz-network-button-text', colors.networkButtonText);

  // Apply action colors
  root.style.setProperty('--layerz-send', colors.send);
  root.style.setProperty('--layerz-receive', colors.receive);

  // Apply essential colors
  root.style.setProperty('--layerz-white', colors.white);
  root.style.setProperty('--layerz-black', colors.black);
}

/**
 * Sets up a listener to update CSS variables when system theme changes
 */
export function setupThemeListener(): void {
  // Apply the theme immediately
  applyThemeToCSS();

  // Set up a listener for theme changes
  const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  darkModeQuery.addEventListener('change', () => {
    applyThemeToCSS();
  });
}
