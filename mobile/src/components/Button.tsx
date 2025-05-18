import React from 'react';
import { Button as TamaguiButton } from 'tamagui';
import { ButtonProps } from '../../../shared/components/Button';

/**
 * Mobile implementation of the Button component using Tamagui.
 * This component imports and re-exports the shared Button component
 * to ensure consistent behavior across the extension and mobile app.
 */
export const Button: React.FC<ButtonProps> = ({ onPress, children, variant = 'primary', size = 'medium', disabled = false, isLoading = false, fullWidth = false, testID }) => {
  // Import the shared Button component to maintain consistency
  const SharedButton = require('../../../shared/components/Button').default;

  return (
    <SharedButton variant={variant} size={size} disabled={disabled} isLoading={isLoading} fullWidth={fullWidth} onPress={onPress} testID={testID}>
      {children}
    </SharedButton>
  );
};

export default Button;
