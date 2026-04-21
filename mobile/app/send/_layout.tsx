import type { PrepareSendResponse } from '@breeztech/breez-sdk-liquid';
import { Stack } from 'expo-router';
import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import * as bolt11 from 'bolt11';

import { BackgroundExecutor } from '@/src/modules/background-executor';
import Lnurl, { LnurlPayServicePayload } from '@shared/class/lnurl';
import * as BlueElectrum from '@shared/blue_modules/BlueElectrum';
import { TFeeEstimate } from '@shared/blue_modules/BlueElectrum';
import { HDSegwitBech32Wallet } from '@shared/class/wallets/hd-segwit-bech32-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { GetBtcSendDataResponse } from '@shared/types/IBackgroundCaller';
import { NETWORK_ARK, NETWORK_BITCOIN, NETWORK_LIGHTNING, NETWORK_LIGHTNING_TESTNET, NETWORK_LIQUID, NETWORK_LIQUID_TESTNET, NETWORK_SPARK, Networks } from '@shared/types/networks';

import { Denomination } from '@shared/types/transfer';

// Bitcoin-specific data types
export type BtcSendData = GetBtcSendDataResponse;

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

export type LightningLayer = typeof NETWORK_ARK | typeof NETWORK_SPARK | typeof NETWORK_LIQUID | typeof NETWORK_LIQUID_TESTNET;

export type DecodedInvoice = ReturnType<typeof bolt11.decode>;

export interface LightningNetworkData {
  layer?: LightningLayer;
  setLayer: React.Dispatch<React.SetStateAction<LightningLayer | undefined>>;
  invoice: string;
  setInvoice: (invoice: string) => void;
  decodedInvoice: DecodedInvoice | undefined;
  setDecodedInvoice: React.Dispatch<React.SetStateAction<DecodedInvoice | undefined>>;
  lnurlInstance: Lnurl | undefined;
  setLnurlInstance: React.Dispatch<React.SetStateAction<Lnurl | undefined>>;
  lnurlPayServicePayload: LnurlPayServicePayload | undefined;
  setLnurlPayServicePayload: React.Dispatch<React.SetStateAction<LnurlPayServicePayload | undefined>>;
}
// Generic send flow context
export interface SendFlowContextData {
  // Generic fields (all networks)
  network: Networks;
  address: string;
  amount: string;
  token?: string;
  denomination: Denomination;
  memo: string;

  // Bitcoin-specific data
  bitcoin: BitcoinNetworkData | undefined;

  // Liquid-specific data
  liquidPrepareResult: PrepareSendResponse | undefined;

  // Lightning-specific data
  lightning: LightningNetworkData | undefined;

  // Generic created transaction
  createdTransaction: CreatedTransaction | undefined;

  // Generic actions
  setNetwork: (network: Networks) => void;
  setAddress: (address: string) => void;
  setAmount: (amount: string) => void;
  setToken: (token?: string) => void;
  setDenomination: (denomination: Denomination) => void;
  setMemo: (memo: string) => void;
  setCreatedTransaction: (transaction: CreatedTransaction | undefined) => void;
  setLiquidPrepareResult: (result: PrepareSendResponse | undefined) => void;
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
  const [memo, setMemo] = useState<string>('');

  // Bitcoin-specific state
  const [btcSendData, setBtcSendData] = useState<BtcSendData | undefined>(undefined);
  const [btcFeeEstimate, setBtcFeeEstimate] = useState<TFeeEstimate | undefined>(undefined);
  const [btcFeeLoadingError, setBtcFeeLoadingError] = useState<string | undefined>(undefined);
  const [isBtcLoadingSendData, setIsBtcLoadingSendData] = useState(false);
  const [isBtcLoadingFees, setIsBtcLoadingFees] = useState(false);

  // Lightning-specific state
  const [lightningLayer, setLayer] = useState<LightningLayer | undefined>(undefined);
  const [invoice, setInvoice] = useState<string>('');
  const [decodedInvoice, setDecodedInvoice] = useState<DecodedInvoice | undefined>(undefined);
  const [lnurlInstance, setLnurlInstance] = useState<Lnurl | undefined>(undefined);
  const [lnurlPayServicePayload, setLnurlPayServicePayload] = useState<LnurlPayServicePayload | undefined>(undefined);

  // Liquid-specific state
  const [liquidPrepareResult, setLiquidPrepareResult] = useState<PrepareSendResponse | undefined>(undefined);

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
    setMemo('');
    setCreatedTransaction(undefined);
    setLiquidPrepareResult(undefined);
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

  const lightningData: LightningNetworkData | undefined =
    network === NETWORK_LIGHTNING || network === NETWORK_LIGHTNING_TESTNET
      ? {
          layer: lightningLayer,
          setLayer,
          invoice,
          setInvoice,
          decodedInvoice,
          setDecodedInvoice,
          lnurlInstance,
          setLnurlInstance,
          lnurlPayServicePayload,
          setLnurlPayServicePayload,
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
        memo,
        bitcoin: bitcoinData,
        lightning: lightningData,
        liquidPrepareResult,
        createdTransaction,
        setNetwork,
        setAddress,
        setAmount,
        setToken,
        setDenomination,
        setMemo,
        setCreatedTransaction,
        setLiquidPrepareResult,
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
        <Stack.Screen name="send-amount-acc" />
        <Stack.Screen name="send-amount-liquid" />
        <Stack.Screen name="send-confirm" />
        <Stack.Screen name="send-address-usdt" />
        <Stack.Screen name="send-amount-usdt" />
        <Stack.Screen name="withdraw-lightning" />
      </Stack>
    </SendFlowProvider>
  );
}
