/**
 * Renderless component that monitors native deposit transfers (BTC → ARK/Spark)
 * and automatically claims them once they have enough on-chain confirmations.
 *
 * Mirror of mobile's AutoClaimMonitor, adapted to the desktop (Electrobun/CEF) renderer:
 * foreground detection uses the DOM `visibilitychange` event instead of RN `AppState`.
 *
 * Startup is deferred: waits 5s after READY + requestIdleCallback to avoid impacting
 * initial load. Auto-claims are triggered on app start (deferred), on window foreground,
 * and every 60s via the shared periodic monitor.
 *
 * Mounts in the root provider tree so it runs regardless of which route is active.
 */
import { useContext, useEffect, useRef } from 'react';

import { ArkWallet } from '@shared/class/wallets/ark-wallet';
import { SparkWallet } from '@shared/class/wallets/spark-wallet';
import { EStep, InitializationContext } from '@shared/hooks/InitializationContext';
import { swapFetcher } from '@shared/hooks/useSwaps';
import { processAutoClaimsNow, setNativeDepositClaimExecutor, setNativeDepositSwapsFetcher, startAutoClaimMonitor, stopAutoClaimMonitor, useTransferService } from '@shared/hooks/useTransferService';
import { TSupportedLazyInitWalletNetworks } from '@shared/modules/wallet-utils';
import { LayerzStorage } from '../class/layerz-storage';
import { BackgroundCaller } from '../modules/background-caller';

const STARTUP_DELAY_MS = 5_000;

export default function AutoClaimMonitor(): null {
  const { step } = useContext(InitializationContext);
  const started = useRef(false);

  useTransferService(LayerzStorage);

  useEffect(() => {
    if (step !== EStep.READY) return;

    const idleHandle: { current: ReturnType<typeof requestIdleCallback> | null } = { current: null };

    const timeout = setTimeout(() => {
      idleHandle.current = requestIdleCallback(() => {
        if (started.current) return;
        started.current = true;

        setNativeDepositSwapsFetcher((network, acct) => {
          return swapFetcher({ cacheKey: 'autoClaimSwapFetcher', accountNumber: acct, network, backgroundCaller: BackgroundCaller });
        });

        setNativeDepositClaimExecutor(async (network, acct, swap) => {
          const wallet = await BackgroundCaller.lazyInitWallet(network as TSupportedLazyInitWalletNetworks, acct);
          if (wallet instanceof SparkWallet) {
            const quote = await wallet.getDepositQuote(swap.id);
            const sparkTransferId = await wallet.claimDepositSpark(quote);
            return { receiveTransferId: sparkTransferId, creditAmountSats: quote.creditAmountSats };
          } else if (wallet instanceof ArkWallet) {
            // SDK VtxoManager auto-settles boarding UTXOs — just poll for the result
            const settled = await wallet.getSettledBoardingAmount(swap.id);
            if (settled) {
              return { receiveTransferId: settled.txid, creditAmountSats: settled.creditAmountSats };
            }
            // SDK hasn't settled yet — return empty (transfer stays claimable, no error)
            return {};
          }
          return {};
        });

        startAutoClaimMonitor();
      });
    }, STARTUP_DELAY_MS);

    return () => {
      clearTimeout(timeout);
      if (idleHandle.current) cancelIdleCallback(idleHandle.current);
      stopAutoClaimMonitor();
      started.current = false;
    };
  }, [step]);

  useEffect(() => {
    if (step !== EStep.READY) return;
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && started.current) {
        processAutoClaimsNow();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [step]);

  return null;
}
