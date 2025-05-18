import React from 'react';
import { ButtonProps } from '../../../shared/components/Button';

/**
 * Extension implementation of the Button component using Tamagui.
 * This component imports and re-exports the shared Button component
 * to ensure consistent behavior across the extension and mobile app.
 */
export const Button = ({ 
  onPress, 
  children, 
  variant = 'primary', 
  size = 'medium', 
  disabled = false, 
  isLoading = false, 
  fullWidth = false, 
  testID 
}: ButtonProps) => {
  // Import the shared Button component to maintain consistency
  const SharedButton = require('../../../shared/components/Button').default;
  
  return (
    <SharedButton 
      variant={variant} 
      size={size} 
      disabled={disabled} 
      isLoading={isLoading} 
      fullWidth={fullWidth} 
      onPress={onPress} 
      testID={testID}
    >
      {children}
    </SharedButton>
  );
};

export default Button;
