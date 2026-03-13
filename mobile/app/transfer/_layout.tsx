import { Stack } from 'expo-router';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

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

  setSendAsset: (asset: AssetId | undefined) => void;
  setReceiveAsset: (asset: AssetId | undefined) => void;
  setQuote: (quote: TransferQuote | undefined) => void;

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

function TransferFlowProvider({ children }: { children: ReactNode }) {
  const [sendAsset, setSendAsset] = useState<AssetId | undefined>(undefined);
  const [receiveAsset, setReceiveAsset] = useState<AssetId | undefined>(undefined);
  const [quote, setQuote] = useState<TransferQuote | undefined>(undefined);
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
        setSendAsset,
        setReceiveAsset,
        setQuote,
        transferService,
      }}
    >
      {children}
    </TransferFlowContext.Provider>
  );
}

export default function TransferLayout() {
  return (
    <TransferFlowProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 350,
          gestureEnabled: true,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen
          name="select-asset"
          options={{
            presentation: 'transparentModal',
            headerShown: false,
            gestureEnabled: true,
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="confirm"
          options={{
            presentation: 'transparentModal',
            headerShown: false,
            gestureEnabled: true,
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="success"
          options={{
            presentation: 'transparentModal',
            headerShown: false,
            gestureEnabled: true,
            animation: 'fade',
          }}
        />
      </Stack>
    </TransferFlowProvider>
  );
}
