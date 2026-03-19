import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { LayerzStorage } from '@/src/class/layerz-storage';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { setFlashnetAccountNumber, setNativeDepositSwapsFetcher, useTransferService } from '@shared/hooks/useTransferService';
import { swapFetcher } from '@shared/hooks/useSwaps';
import { TransferServiceManager } from '@shared/services/transfer-service-manager';
import { AssetId } from '@shared/types/asset';
import { NETWORK_SPARK } from '@shared/types/networks';
import { TransferQuote } from '@shared/types/transfer';

export interface TransferFlowContextData {
  sendAsset: AssetId | undefined;
  receiveAsset: AssetId | undefined;
  quote: TransferQuote | undefined;
  committed: boolean;

  setSendAsset: (asset: AssetId | undefined) => void;
  setReceiveAsset: (asset: TransferFlowContextData['receiveAsset']) => void;
  setQuote: (quote: TransferQuote | undefined) => void;
  setCommitted: (committed: boolean) => void;

  transferService: TransferServiceManager;
}

const TransferFlowContext = createContext<TransferFlowContextData | undefined>(undefined);

export function useTransferFlow() {
  const context = useContext(TransferFlowContext);
  if (!context) {
    throw new Error('useTransferFlow must be used within TransferFlowProvider');
  }
  return context;
}

export function TransferFlowProvider({ children }: { children: ReactNode }) {
  const params = useLocalSearchParams<{ sendAsset?: string; receiveAsset?: string }>();

  const [sendAsset, setSendAsset] = useState<AssetId | undefined>((params.sendAsset as AssetId) || 'native:bitcoin');
  const [receiveAsset, setReceiveAsset] = useState<AssetId | undefined>((params.receiveAsset as AssetId) || undefined);
  const [quote, setQuote] = useState<TransferQuote | undefined>(undefined);
  const [committed, setCommitted] = useState(false);
  const transferService = useTransferService(LayerzStorage);
  const { accountNumber } = useContext(AccountNumberContext);

  useEffect(() => {
    setNativeDepositSwapsFetcher((network, acct) => swapFetcher({ cacheKey: 'ndSwapFetcher', accountNumber: acct, network, backgroundCaller: BackgroundExecutor }));
  }, []);

  // Ensure Spark wallet is initialized so Flashnet swaps can work
  useEffect(() => {
    setFlashnetAccountNumber(accountNumber);
    BackgroundExecutor.lazyInitWallet(NETWORK_SPARK, accountNumber).catch(() => {});
  }, [accountNumber]);

  return (
    <TransferFlowContext.Provider
      value={{
        sendAsset,
        receiveAsset,
        quote,
        committed,
        setSendAsset,
        setReceiveAsset,
        setQuote,
        setCommitted,
        transferService,
      }}
    >
      {children}
    </TransferFlowContext.Provider>
  );
}
