import { BackgroundExecutor } from '@/src/modules/background-executor';
import * as BlueElectrum from '@shared/blue_modules/BlueElectrum';
import { TFeeEstimate } from '@shared/blue_modules/BlueElectrum';
import { HDSegwitBech32Wallet } from '@shared/class/wallets/hd-segwit-bech32-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { NETWORK_BITCOIN, Networks } from '@shared/types/networks';
import { Stack } from 'expo-router';
import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';

// Bitcoin-specific data types
export interface BtcSendData {
  utxos: any[];
  changeAddress: string;
}

export interface CreatedTransaction {
  txhex: string;
  actualFee: number;
  feeRate?: number;
}

export interface BitcoinNetworkData {
  wallet: HDSegwitBech32Wallet;
  sendData: BtcSendData | undefined;
  feeEstimate: TFeeEstimate | undefined;
  isLoadingSendData: boolean;
  isLoadingFees: boolean;
  feeLoadingError: string | undefined;
}

// Denomination type
export type Denomination = 'Native' | 'Fiat';

// Generic send flow context
export interface SendFlowContextData {
  // Generic fields (all networks)
  network: Networks;
  address: string;
  amount: string;
  token?: string;
  denomination: Denomination;

  // Bitcoin-specific data
  bitcoin: BitcoinNetworkData | undefined;

  // Generic created transaction
  createdTransaction: CreatedTransaction | undefined;

  // Generic actions
  setNetwork: (network: Networks) => void;
  setAddress: (address: string) => void;
  setAmount: (amount: string) => void;
  setToken: (token?: string) => void;
  setDenomination: (denomination: Denomination) => void;
  setCreatedTransaction: (transaction: CreatedTransaction | undefined) => void;
  reset: () => void;
}

const SendFlowContext = createContext<SendFlowContextData | undefined>(undefined);

export function useSendFlow() {
  const context = useContext(SendFlowContext);
  if (!context) {
    throw new Error('useSendFlow must be used within SendFlowProvider');
  }
  return context;
}

interface SendFlowProviderProps {
  children: ReactNode;
  initialNetwork: Networks;
}

function SendFlowProvider({ children, initialNetwork }: SendFlowProviderProps) {
  const { accountNumber } = useContext(AccountNumberContext);
  const [network, setNetwork] = useState<Networks>(initialNetwork);
  const [address, setAddress] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [token, setToken] = useState<string | undefined>(undefined);
  const [denomination, setDenomination] = useState<Denomination>('Native');

  // Bitcoin-specific state
  const [btcSendData, setBtcSendData] = useState<BtcSendData | undefined>(undefined);
  const [btcFeeEstimate, setBtcFeeEstimate] = useState<TFeeEstimate | undefined>(undefined);
  const [btcFeeLoadingError, setBtcFeeLoadingError] = useState<string | undefined>(undefined);
  const [isBtcLoadingSendData, setIsBtcLoadingSendData] = useState(false);
  const [isBtcLoadingFees, setIsBtcLoadingFees] = useState(false);

  // Generic created transaction (for all networks)
  const [createdTransaction, setCreatedTransaction] = useState<CreatedTransaction | undefined>(undefined);

  // Create Bitcoin wallet instance once
  const btcWallet = useRef(new HDSegwitBech32Wallet()).current;

  // Load Bitcoin-specific data when network is Bitcoin
  useEffect(() => {
    if (network !== NETWORK_BITCOIN) return;

    const loadBtcSendData = async () => {
      setIsBtcLoadingSendData(true);
      try {
        const r = await BackgroundExecutor.getBtcSendData(accountNumber);
        setBtcSendData(r);
      } catch (e) {
        console.error('Failed to fetch Bitcoin UTXOs', e);
      } finally {
        setIsBtcLoadingSendData(false);
      }
    };
    loadBtcSendData();
  }, [accountNumber, network]);

  // Load Bitcoin fee estimates when network is Bitcoin
  useEffect(() => {
    if (network !== NETWORK_BITCOIN) return;

    const loadBtcFees = async () => {
      setIsBtcLoadingFees(true);
      setBtcFeeLoadingError(undefined);
      try {
        if (!BlueElectrum.mainConnected) {
          await BlueElectrum.connectMain();
        }
        const r = await BlueElectrum.estimateFees();
        setBtcFeeEstimate(r);
        setBtcFeeLoadingError(undefined);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Failed to load network fees';
        setBtcFeeLoadingError(errorMessage);
      } finally {
        setIsBtcLoadingFees(false);
      }
    };
    loadBtcFees();
  }, [network]);

  const reset = () => {
    setAddress('');
    setAmount('');
    setToken(undefined);
    setDenomination('Native');
    setCreatedTransaction(undefined);
  };

  // Construct Bitcoin-specific data object
  const bitcoinData: BitcoinNetworkData | undefined =
    network === NETWORK_BITCOIN
      ? {
          wallet: btcWallet,
          sendData: btcSendData,
          feeEstimate: btcFeeEstimate,
          feeLoadingError: btcFeeLoadingError,
          isLoadingSendData: isBtcLoadingSendData,
          isLoadingFees: isBtcLoadingFees,
        }
      : undefined;

  return (
    <SendFlowContext.Provider
      value={{
        network,
        address,
        amount,
        token,
        denomination,
        bitcoin: bitcoinData,
        createdTransaction,
        setNetwork,
        setAddress,
        setAmount,
        setToken,
        setDenomination,
        setCreatedTransaction,
        reset,
      }}
    >
      {children}
    </SendFlowContext.Provider>
  );
}

export default function SendLayout() {
  const { network: contextNetwork } = useContext(NetworkContext);

  return (
    <SendFlowProvider initialNetwork={contextNetwork}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 350,
          gestureEnabled: true,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="send-address" />
        <Stack.Screen name="send-amount-btc" />
        <Stack.Screen name="send-amount-evm" />
        <Stack.Screen name="send-confirm" />
      </Stack>
    </SendFlowProvider>
  );
}
