import { gradients } from '@shared/constants/Colors';

/**
 * Gets the gradient colors for a given network variant
 * @param variant - The network variant (e.g., 'bitcoin', 'lightning', 'spark')
 * @returns Array of gradient colors
 */
export const getGradientColors = (variant: string = 'base') => {
  let id: keyof typeof gradients = 'base';

  for (const key of Object.keys(gradients)) {
    if (key.startsWith(variant)) {
      // this will work for liquid-testnet, for example.
      id = key as keyof typeof gradients;
      break;
    }
  }

  return gradients[id];
};

/**
 * Gets the primary gradient color (first color in the gradient) for a given network variant
 * Useful for QR code backgrounds, button colors, etc.
 * @param variant - The network variant (e.g., 'bitcoin', 'lightning', 'spark')
 * @returns The primary color from the gradient
 */
export const getGradientPrimaryColor = (variant: string = 'base'): string => {
  const colors = getGradientColors(variant);
  return colors[0];
};
