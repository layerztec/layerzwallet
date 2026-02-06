import { useEffect } from 'react';
import HomeComponent from '../Home';

export default function HomeTab() {
  useEffect(() => {
    console.log('🟡 HomeTab: Component mounted');
    return () => {
      console.log('🟡 HomeTab: Component unmounted');
    };
  }, []);

  console.log('🟡 HomeTab: Rendering Home component');
  return <HomeComponent />;
}
