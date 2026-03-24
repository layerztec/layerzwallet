/**
 * Renderless component that monitors native deposit transfers (BTC → ARK/Spark)
 * and automatically claims them once they have enough on-chain confirmations.
 *
 * Startup is deferred: waits 5s after READY + requestIdleCallback
 * to avoid impacting initial load performance.
 *
 * Auto-claims are triggered at three moments:
 * 1. On app start (deferred) — catches claims pending from a previous session
 * 2. On app foreground (AppState → 'active') — retries after background failures or mempool rejections
 * 3. Every 60s via periodic timer — ongoing monitoring while the app is active
 *
 * Mounts in the root provider tree so it runs regardless of which screen is active.
 */
import { useContext, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { LayerzStorage } from '@/src/class/layerz-storage';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { ArkWallet } from '@shared/class/wallets/ark-wallet';
import { SparkWallet } from '@shared/class/wallets/spark-wallet';
import { EStep, InitializationContext } from '@shared/hooks/InitializationContext';
import { swapFetcher } from '@shared/hooks/useSwaps';
import { setNativeDepositClaimExecutor, setNativeDepositSwapsFetcher, startAutoClaimMonitor, stopAutoClaimMonitor, processAutoClaimsNow, useTransferService } from '@shared/hooks/useTransferService';
import { TSupportedLazyInitWalletNetworks } from '@shared/modules/wallet-utils';

const STARTUP_DELAY_MS = 5_000;

export default function AutoClaimMonitor() {
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
          return swapFetcher({ cacheKey: 'autoClaimSwapFetcher', accountNumber: acct, network, backgroundCaller: BackgroundExecutor });
        });

        setNativeDepositClaimExecutor(async (network, acct, swap) => {
          try {
            const wallet = await BackgroundExecutor.lazyInitWallet(network as TSupportedLazyInitWalletNetworks, acct);
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
          } catch (e) {
            throw e;
          }
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
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && started.current) {
        processAutoClaimsNow();
      }
    });
    return () => sub.remove();
  }, [step]);

  return null;
}
