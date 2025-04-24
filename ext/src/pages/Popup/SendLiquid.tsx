import { AddressRecipient, UnblindedOutput } from '@shared/class/wallets/liquid-deps/types';
import { LiquidWallet } from '@shared/class/wallets/liquid-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useBalance } from '@shared/hooks/useBalance';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { getDeviceID } from '@shared/modules/device-id';
import { formatBalance } from '@shared/modules/string-utils';
import { withRetry } from '@shared/modules/tenacity';
import { ENCRYPTED_PREFIX, STORAGE_KEY_LIQUID_MBK, STORAGE_KEY_LIQUID_XPUB, STORAGE_KEY_MNEMONIC } from '@shared/types/IStorage';
import assert from 'assert';
import BigNumber from 'bignumber.js';
import * as bip21 from 'bip21';
import { Scan, SendIcon } from 'lucide-react';
import { default as React, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayerzStorage } from '../../class/layerz-storage';
import { Csprng } from '../../class/rng';
import { SecureStorage } from '../../class/secure-storage';
import { AskPasswordContext } from '../../hooks/AskPasswordContext';
import { useScanQR } from '../../hooks/ScanQrContext';
import { BackgroundCaller } from '../../modules/background-caller';
import { decrypt } from '../../modules/encryption';
import { Button, HodlButton, Input, WideButton } from './DesignSystem';
import ClipboardBackdoor from './components/ClipboardBackdoor';

type TDataState =
  | {
      utxos: UnblindedOutput[];
      txDetails: LiquidWallet['txDetails'];
      outpointBlindingData: LiquidWallet['outpointBlindingData'];
      scriptsDetails: LiquidWallet['scriptsDetails'];
    }
  | undefined;

const SendLiquid: React.FC = () => {
  const scanQr = useScanQR();
  const navigate = useNavigate();
  const walletRef = useRef<LiquidWallet | undefined>();
  const [toAddress, setToAddress] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [sendState, setSendState] = useState<'idle' | 'preparing' | 'signed' | 'success'>('idle');
  const [sendData, setSendData] = useState<TDataState>();
  const [txhex, setTxhex] = useState<string>('');
  const [actualFee, setActualFee] = useState<number>();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { askPassword } = useContext(AskPasswordContext);
  const { balance } = useBalance(network, accountNumber, BackgroundCaller);

  useEffect(() => {
    (async () => {
      const xpub = await SecureStorage.getItem(STORAGE_KEY_LIQUID_XPUB + accountNumber);
      const masterBlindingKey = await SecureStorage.getItem(STORAGE_KEY_LIQUID_MBK);
      try {
        walletRef.current = new LiquidWallet('testnet');
        await walletRef.current.init({ xpub, masterBlindingKey });
      } catch (err: any) {
        setError(err.message);
      }
    })();
  }, [accountNumber]);

  useEffect(() => {
    (async () => {
      try {
        await withRetry(async () => {
          console.log('fetching getLiquidSendData...');
          const r = await BackgroundCaller.getLiquidSendData(network, accountNumber);
          console.log('...done fetching getLiquidSendData!');
          setSendData(r);
          if (!walletRef.current) {
            throw new Error('Wallet not initialized');
          }
          walletRef.current.txDetails = r.txDetails;
          walletRef.current.outpointBlindingData = r.outpointBlindingData;
          walletRef.current.scriptsDetails = r.scriptsDetails;
        });
      } catch (e: any) {
        console.log('Failed to fetch UTXOs after retries', e);
        setError('Failed to load UTXOs');
      }
    })();
  }, [accountNumber, network]);

  const actualSend = async () => {
    try {
      if (!walletRef.current) {
        throw new Error('Wallet not initialized');
      }
      const result = await walletRef.current.chainSource!.broadcastTransaction(txhex);
      if (!result) {
        throw new Error('Transaction failed');
      }
      setSendState('success');
    } catch (error: any) {
      setError(error.message);
    }
  };

  const prepareTransaction = async () => {
    setSendState('preparing');
    setError('');
    try {
      // check wallet
      const w = walletRef.current;
      assert(w, 'internal error: wallet not loaded');
      const asset = w.network.assetHash;

      // check amount
      assert(balance, 'internal error: balance not loaded');
      const amt = parseFloat(amount);
      assert(!isNaN(amt), 'Invalid amount');
      assert(amt > 0, 'Amount should be > 0');
      const satValueBN = new BigNumber(amt);
      const satValue = satValueBN.multipliedBy(new BigNumber(10).pow(getDecimalsByNetwork(network))).toString(10);
      assert(new BigNumber(balance).gte(satValue), 'Not enough balance');

      // check address
      assert(toAddress, 'recipient address empty');
      if (!w.isAddressValid(toAddress)) {
        throw new Error('recipient address is not valid');
      }

      const password = await askPassword();
      const encryptedMnemonic = await SecureStorage.getItem(STORAGE_KEY_MNEMONIC);
      assert(encryptedMnemonic.startsWith(ENCRYPTED_PREFIX), 'Mnemonic not encrypted, reinstall the extension');
      let decrypted: string;
      try {
        decrypted = await decrypt(encryptedMnemonic.replace(ENCRYPTED_PREFIX, ''), password, await getDeviceID(LayerzStorage, Csprng));
      } catch (_) {
        // only catching and re-throwing to change the error message. probably would be better to
        // make a separate place to interpret errors and display the appropriate ones
        throw new Error('Incorrect password');
      }

      assert(sendData?.utxos, 'internal error: utxo not loaded');

      // construct transaction
      const relayFee = (await w.chainSource!.getRelayFee()) * 1.1;
      assert(relayFee, 'internal error: relay fee not loaded');

      const targets: AddressRecipient[] = [
        {
          address: toAddress,
          value: Number(satValue),
          asset,
        },
      ];
      const tx = w.createTransaction(sendData.utxos, relayFee, targets);
      const final = w.signAndFinalize(tx.pset, decrypted);

      assert(tx, 'Internal error: Wallet.createTransaction failed');
      setTxhex(final.tx);
      setActualFee(tx.fee);
      setSendState('signed');
    } catch (error: any) {
      console.error(error.message);
      console.error(error);
      setError(error.message);
      setSendState('idle');
    }
  };

  const handleScanQR = async () => {
    const scanned = await scanQr();
    console.log({ scanned });
    if (scanned) {
      try {
        const decoded = bip21.decode(scanned);
        if (decoded?.address) setToAddress(decoded.address);
        if (decoded?.options?.amount) setAmount(String(decoded.options.amount));
      } catch (_) {
        setToAddress(scanned);
      }
    }
  };

  if (sendState === 'success') {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <div style={{ color: '#4CAF50', fontSize: '48px', marginBottom: '20px' }}>✓</div>
        <h2 style={{ color: '#4CAF50', marginBottom: '15px' }}>Sent!</h2>
        <p style={{ color: '#666', marginBottom: '20px' }}>Your {getTickerByNetwork(network)} are on their way</p>
        <WideButton onClick={() => navigate('/')}>Back to Wallet</WideButton>
      </div>
    );
  }

  return (
    <div>
      <h2>Send {getTickerByNetwork(network)}</h2>
      <div style={{ textAlign: 'left' }}>
        <b>Recipient</b>
        <div style={{ marginBottom: '10px' }}></div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Input
            data-testid="recipient-address-input"
            type="text"
            placeholder="Enter the recipient's address"
            onChange={(event) => setToAddress(event.target.value)}
            value={toAddress}
            style={{ flexGrow: 1, marginRight: '10px' }}
          />
          <Button
            style={{
              marginBottom: '10px',
              marginLeft: '5px',
              border: '1px solid #282c34',
              borderRadius: '5px',
              width: '50px',
              height: '40px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'white',
              color: 'black',
              cursor: 'pointer',
              paddingLeft: '25px',
            }}
            onClick={handleScanQR}
          >
            <Scan />
          </Button>
        </div>
      </div>
      <hr />
      <div style={{ textAlign: 'left' }}>
        <b>Amount</b>
        <div style={{ marginBottom: '10px' }}></div>
        <Input type="number" data-testid="amount-input" placeholder="0.00" onChange={(event) => setAmount(event.target.value)} value={amount} />
        <div style={{ color: 'gray', width: '100%', marginBottom: '15px' }}>
          <span style={{ fontSize: 16 }}>
            Available balance: {balance ? formatBalance(balance, getDecimalsByNetwork(network), 8) : ''} {getTickerByNetwork(network)}
          </span>
        </div>
      </div>

      <br />
      <div style={{ width: '100%' }}>
        {error ? (
          <div style={{ color: 'red', width: '100%', marginBottom: '15px' }}>
            <span style={{ fontSize: 16 }}>{error}</span>
          </div>
        ) : null}

        {sendState === 'preparing' ? <span>loading...</span> : null}

        {sendState === 'idle' ? (
          <WideButton data-testid="send-screen-send-button" onClick={prepareTransaction} disabled={!sendData}>
            <SendIcon />
            Send
          </WideButton>
        ) : null}

        {sendState === 'signed' ? (
          <div>
            <span style={{ color: 'gray', fontSize: '16px' }}>
              Actual fee for this transaction: {formatBalance(String(actualFee), getDecimalsByNetwork(network), 8)} {getTickerByNetwork(network)}
            </span>
            <HodlButton onHold={actualSend}>
              <SendIcon />
              Hold to confirm send
            </HodlButton>

            <button
              onClick={() => {
                setSendState('idle');
                setTxhex('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'gray',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: '16px',
                marginTop: '10px',
              }}
            >
              Cancel
            </button>

            <ClipboardBackdoor text={txhex} />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SendLiquid;
