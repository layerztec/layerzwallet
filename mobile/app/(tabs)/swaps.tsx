import { useEffect } from 'react';
import SwapComponent from '../Swap';

export default function SwapsTab() {
  useEffect(() => {
    console.log('🟠 SwapsTab: Component mounted');
    return () => {
      console.log('🟠 SwapsTab: Component unmounted');
    };
  }, []);

  console.log('🟠 SwapsTab: Rendering Swap component');
  return <SwapComponent />;
}
