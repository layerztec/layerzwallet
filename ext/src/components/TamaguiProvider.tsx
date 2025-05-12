import React from 'react';
import { SimpleTamaguiProvider } from './SimpleTamaguiProvider';

type TamaguiProviderWrapperProps = {
  children: React.ReactNode;
};

/**
 * Wrapper for TamaguiProvider that uses the simplified implementation
 * This avoids issues with environment variables being injected incorrectly
 */
export function TamaguiProviderWrapper({ children }: TamaguiProviderWrapperProps) {
  // Simply use the SimpleTamaguiProvider which has a minimal configuration
  // This avoids all the issues with the complex tamaguiConfig and environment variables
  return <SimpleTamaguiProvider>{children}</SimpleTamaguiProvider>;
}
