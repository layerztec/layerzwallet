import { useEffect } from 'react';
import DAppBrowserComponent from '../DAppBrowser';

export default function ExplorerTab() {
  useEffect(() => {
    console.log('🟣 ExplorerTab: Component mounted');
    return () => {
      console.log('🟣 ExplorerTab: Component unmounted');
    };
  }, []);

  console.log('🟣 ExplorerTab: Rendering DAppBrowser component');
  return <DAppBrowserComponent />;
}
