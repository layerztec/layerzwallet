import { useEffect, useState } from 'react';

import { fetchBuyBitcoinVisible } from '@/src/utils/buy-bitcoin-visibility';

export function useShowBuyBitcoinButton(): boolean {
  const [showBuyBitcoinButton, setShowBuyBitcoinButton] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void fetchBuyBitcoinVisible().then((visible) => {
      if (!cancelled) {
        setShowBuyBitcoinButton(visible);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return showBuyBitcoinButton;
}
