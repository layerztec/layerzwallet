import React, { useContext, useRef, useState } from 'react';
import { Button, HodlButton, Input, WideButton } from './DesignSystem';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { DEFAULT_NETWORK } from '@shared/config';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { Scan, SendIcon } from 'lucide-react';
import { useBalance } from '@shared/hooks/useBalance';
import BigNumber from 'bignumber.js';
import assert from 'assert';
import { AskPasswordContext } from '../../hooks/AskPasswordContext';
import { useNavigate } from 'react-router-dom';
import { decrypt } from '../../modules/encryption';
import { getDeviceID } from '@shared/modules/device-id';
import { ArkWallet } from '@shared/class/wallets/ark-wallet';
import { formatBalance } from '@shared/modules/string-utils';
import { ScanQrContext } from '../../hooks/ScanQrContext';
import { SecureStorage } from '../../class/secure-storage';
import { ENCRYPTED_PREFIX, STORAGE_KEY_MNEMONIC } from '@shared/types/IStorage';
import { BackgroundCaller } from '../../modules/background-caller';
import { LayerzStorage } from '../../class/layerz-storage';
import { Csprng } from '../../class/rng';

const SendArk: React.FC = () => {
  const { scanQr } = useContext(ScanQrContext);
  const navigate = useNavigate();
  const [toAddress, setToAddress] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isPreparing, setIsPreparing] = useState<boolean>(false);
  const [isPrepared, setIsPrepared] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { askPassword } = useContext(AskPasswordContext);
  const { balance } = useBalance(network ?? DEFAULT_NETWORK, accountNumber, BackgroundCaller);
  const arkWallet = useRef<ArkWallet | undefined>(undefined);

  const actualSend = async () => {
    try {
      const satValueBN = new BigNumber(amount);
      const satValue = satValueBN.multipliedBy(new BigNumber(10).pow(getDecimalsByNetwork(network))).toString(10);

      if (!arkWallet) {
        throw new Error('Internal error: ArkWallet is not set');
      }

      console.log('actual value to send:', +satValue);

      const transactionId = await arkWallet.current?.pay(toAddress, +satValue);
      assert(transactionId, 'Internal error: ArkWallet.pay() failed');
      console.log('submitted txid:', transactionId);

      setIsSuccess(true);
    } catch (error: any) {
      setError(error.message);
    }
  };

  const prepareTransaction = async () => {
    setIsPreparing(true);
    setError('');
    try {
      // TODO: validate the address
      // TODO: validate the amount

      const password = await askPassword();
      const encryptedMnemonic = await SecureStorage.getItem(STORAGE_KEY_MNEMONIC);
      assert(encryptedMnemonic.startsWith(ENCRYPTED_PREFIX), 'Mnemonic not encrypted, reinstall the extension');
      let decrypted: string;
      try {
        decrypted = await decrypt(encryptedMnemonic.replace(ENCRYPTED_PREFIX, ''), password, await getDeviceID(LayerzStorage, Csprng));

        const w = new ArkWallet();
        w.setSecret(decrypted);
        w.setAccountNumber(accountNumber);
        w.init();
        arkWallet.current = w;
      } catch (_) {
        // only catching and re-throwing to change the error message. probably would be better to
        // make a separate place to interpret errors and display the appropriate ones
        throw new Error('Incorrect password');
      }
      setIsPrepared(true);
    } catch (error: any) {
      console.error(error.message);
      setError(error.message);
    } finally {
      setIsPreparing(false);
    }
  };

  if (isSuccess) {
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
          <Input data-testid="recipient-address-input" type="text" placeholder="Enter the recipient's address" onChange={(event) => setToAddress(event.target.value)} value={toAddress} />
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
            onClick={async () => {
              const scanned = await scanQr();
              console.log({ scanned });
              if (scanned) {
                setToAddress(scanned);
              }
            }}
          >
            <Scan />
          </Button>
        </div>
      </div>
      <hr />
      <div style={{ textAlign: 'left' }}>
        <b>Amount</b>
        <div style={{ marginBottom: '10px' }}></div>
        <Input type="numbers" data-testid="amount-input" placeholder="0.00" onChange={(event) => setAmount(event.target.value)} />
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

        {isPreparing ? <span>loading...</span> : null}

        {!isPreparing && !isPrepared ? (
          <WideButton data-testid="send-screen-send-button" onClick={prepareTransaction}>
            <SendIcon />
            Send
          </WideButton>
        ) : null}

        {isPrepared ? (
          <div>
            <HodlButton onHold={actualSend}>
              <SendIcon />
              Hold to confirm send
            </HodlButton>

            <button
              onClick={() => {
                setIsPreparing(false);
                setIsPrepared(false);
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
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SendArk;
