import React from 'react';
import SimpleButton from '../../shared/components/SimpleButton';
import type { SimpleButtonProps } from '../../shared/components/SimpleButton';

export const Button: React.FC<SimpleButtonProps> = (props) => {
  // Use the SimpleButton implementation that doesn't rely on Tamagui tokens
  return <SimpleButton {...props} />;
};

// Export as both default and named export for flexibility
export default Button;
