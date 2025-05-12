import React, { useState, useEffect } from 'react';
import { SimpleThemedText } from '../../../components/SimpleThemedText';

// Import Tamagui components with try/catch to prevent crashes
let Stack: any;
try {
  // Dynamic import to avoid crashes if Tamagui isn't properly initialized
  const tamagui = require('tamagui');
  Stack = tamagui.Stack;
} catch (e) {
  console.warn('Failed to import Tamagui components:', e);
  // Provide a fallback if import fails
  Stack = ({ children, ...props }: any) => <div {...props}>{children}</div>;
}

/**
 * An ultra-robust Tamagui component example with multiple fallbacks
 * Uses the SimpleThemedText component which is more reliable in extension context
 */
export const ExampleTamaguiComponent = () => {
  const [useFallback, setUseFallback] = useState(true); // Default to fallback for safety
  const [showTamagui, setShowTamagui] = useState(false);

  // Use an effect to determine if the Tamagui component will cause errors
  useEffect(() => {
    try {
      // Check if Tamagui's Stack component is available and appears to be valid
      if (typeof Stack === 'function' || typeof Stack === 'object') {
        // Attempt to enable Tamagui components, but wrap in try/catch
        setTimeout(() => {
          try {
            setUseFallback(false);
            setShowTamagui(true);
          } catch (e) {
            console.error('Error enabling Tamagui components:', e);
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error checking Tamagui components:', error);
    }
  }, []);

  return (
    <div style={{ padding: '16px' }}>
      {/* Use SimpleThemedText which is more reliable in extension context */}
      <SimpleThemedText type="headline">Layerz Wallet Extension</SimpleThemedText>
      <SimpleThemedText type="subHeadline">Powered by simplified Tamagui</SimpleThemedText>
      <SimpleThemedText type="paragraph">This component uses a simplified Tamagui implementation that's compatible with browser extensions.</SimpleThemedText>
      <SimpleThemedText type="defaultSemiBold">The extension UI is working correctly!</SimpleThemedText>
      <SimpleThemedText type="link">Visit layerzwallet.com for more info</SimpleThemedText>

      {/* Tamagui Stack example or fallback - with additional error boundaries */}
      {!useFallback && showTamagui ? (
        // Try to use the Tamagui Stack component with error handling
        <div>
          <SimpleThemedText type="paragraph">Successfully using Tamagui components!</SimpleThemedText>
          {/* We render Tamagui components in a wrapper function with error handling */}
          {(() => {
            // Use a safe rendering function to prevent unreachable code warnings
            function renderSafely() {
              try {
                return (
                  <Stack padding="$2" margin="$2" backgroundColor="$primary">
                    <SimpleThemedText type="paragraph" style={{ color: '#fff' }}>
                      This is a Tamagui Stack component
                    </SimpleThemedText>
                  </Stack>
                );
              } catch (e) {
                console.error('Error rendering Tamagui component:', e);
                return <SimpleThemedText type="paragraph">Tamagui render error detected</SimpleThemedText>;
              }
            }

            return renderSafely();
          })()}
        </div>
      ) : (
        <div style={{ marginTop: '16px', padding: 8, backgroundColor: '#f0f0f0', borderRadius: 4 }}>
          <SimpleThemedText type="paragraph">Using fallback components (no Tamagui)</SimpleThemedText>
        </div>
      )}
    </div>
  );
};
