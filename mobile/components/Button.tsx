import React from 'react';
import SimpleButton, { SimpleButtonProps } from '../../shared/components/SimpleButton';
import CrossPlatformButton from '../../shared/components/CrossPlatformButton';

/**
 * Mobile Button component
 * Currently using SimpleButton implementation that doesn't rely on Tamagui tokens
 * to avoid issues with token resolution in the mobile environment
 */
export const Button: React.FC<SimpleButtonProps> = (props) => {
  // Use the SimpleButton implementation that doesn't rely on Tamagui tokens
  return <SimpleButton {...props} />;

  // If you want to use CrossPlatformButton instead, uncomment this line:
  // return <CrossPlatformButton {...props} />;
};

// Export as both default and named export for flexibility
export default Button;
