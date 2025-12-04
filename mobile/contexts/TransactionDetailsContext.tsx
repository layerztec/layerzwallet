import React, { createContext, useContext, useRef, useState, ReactNode } from 'react';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { CommonTransaction } from '@shared/types/common-transaction';
import TransactionDetails from '@/app/TransactionDetails';

interface TransactionDetailsContextType {
  openTransactionDetails: (transaction: CommonTransaction) => void;
}

const TransactionDetailsContext = createContext<TransactionDetailsContextType | undefined>(undefined);

export function TransactionDetailsProvider({ children }: { children: ReactNode }) {
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const [transaction, setTransaction] = useState<CommonTransaction | null>(null);

  const openTransactionDetails = (tx: CommonTransaction) => {
    setTransaction(tx);
    // Small delay to ensure component is mounted and ref is set
    setTimeout(() => {
      bottomSheetRef.current?.present();
    }, 100);
  };

  const handleDismiss = () => {
    setTransaction(null);
  };

  return (
    <TransactionDetailsContext.Provider value={{ openTransactionDetails }}>
      {children}
      {transaction && <TransactionDetails ref={bottomSheetRef} transaction={transaction} onDismiss={handleDismiss} />}
    </TransactionDetailsContext.Provider>
  );
}

export function useTransactionDetails() {
  const context = useContext(TransactionDetailsContext);
  if (!context) {
    throw new Error('useTransactionDetails must be used within TransactionDetailsProvider');
  }
  return context;
}
