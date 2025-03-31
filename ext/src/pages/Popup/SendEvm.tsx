import React, { useContext, useEffect, useState } from 'react';
import { Button, HodlButton, Input, SelectFeeSlider, WideButton } from './DesignSystem';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { DEFAULT_NETWORK } from '@shared/config';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { Scan, SendIcon } from 'lucide-react';
import { useBalance } from '@shared/hooks/useBalance';
import BigNumber from 'bignumber.js';
import { EvmWallet } from '@shared/class/evm-wallet';
import { BackgroundCaller } from '../../modules/background-caller';
import assert from 'assert';
import { StringNumber } from '@shared/types/string-number';
import { AskPasswordContext } from '../../hooks/AskPasswordContext';
import { useNavigate } from 'react-router-dom';
import { TransactionSuccessProps } from './TransactionSuccessEvm';
import { decrypt } from '../../modules/encryption';
import { getDeviceID } from '@shared/modules/device-id';
import { formatBalance } from '@shared/modules/string-utils';
import { ScanQrContext } from '../../hooks/ScanQrContext';
import { SecureStorage } from '../../class/secure-storage';
import { ENCRYPTED_PREFIX, STORAGE_KEY_MNEMONIC } from '@shared/types/IStorage';
import { LayerzStorage } from '../../class/layerz-storage';
import { Csprng } from '../../class/rng';

const SendEvm: React.FC = () => {
  const { scanQr } = useContext(ScanQrContext);
  const navigate = useNavigate();
  const [address, setAddress] = useState<string>(''); // our address
  const [toAddress, setToAddress] = useState<string>('');
  const [bytes, setBytes] = useState<string>(''); // txhex ready to broadcast
  const [amount, setAmount] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isPreparing, setIsPreparing] = useState<boolean>(false);
  const [fees, setFees] = useState<StringNumber>(); // min fees user will have to pay for the transaction
  const [maxFees, setMaxFees] = useState<StringNumber>(); // max fees user will have to pay for the transaction
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { askPassword } = useContext(AskPasswordContext);
  const { balance } = useBalance(network ?? DEFAULT_NETWORK, accountNumber, BackgroundCaller);
  const [overpayMultiplier, setOverpayMultiplier] = useState<number>(1);

  useEffect(() => {
    BackgroundCaller.getAddress(network || DEFAULT_NETWORK, accountNumber).then((addressResponse) => {
      setAddress(addressResponse);
    });
  }, [accountNumber, network]);

  const broadcastTransaction = async () => {
    try {
      console.log('broadcasting', bytes);
      const e = new EvmWallet();
      const transactionId = await e.broadcastTransaction(network, bytes);
      console.log('broadcasted:', transactionId);
      if (typeof transactionId !== 'string') {
        throw new Error('Error: ' + JSON.stringify(transactionId));
      }

      const satValueBN = new BigNumber(amount);
      const satValue = satValueBN.multipliedBy(new BigNumber(10).pow(getDecimalsByNetwork(network))).toString(10);
      navigate('/transaction-success', { state: { transactionId, amount: satValue, network: network, bytes, recipient: toAddress } as TransactionSuccessProps });
    } catch (error: any) {
      setError(error.message);
    }
  };

  const prepareTransaction = async () => {
    setIsPreparing(true);
    setError('');
    try {
      assert(address, 'internal error: address not loaded');
      assert(balance, 'internal error: balance not loaded');
      assert(toAddress, 'recipient address empty');
      assert(EvmWallet.isAddressValid(toAddress), 'recipient address is not valid');
      const amt = parseFloat(amount);
      assert(!isNaN(amt), 'Invalid amount');
      assert(amt > 0, 'Amount should be > 0');

      const satValueBN = new BigNumber(amt);
      const satValue = satValueBN.multipliedBy(new BigNumber(10).pow(getDecimalsByNetwork(network))).toString(10);
      assert(new BigNumber(balance).gte(satValue), 'Not enough balance');

      const e = new EvmWallet();
      const paymentTransaction = await e.createPaymentTransaction(address, toAddress, satValue);
      const feeData = await e.getFeeData(network);
      let baseFee;
      try {
        baseFee = await e.getBaseFeePerGas(network);
      } catch (_) {
        baseFee = 0n;
      }
      const prepared = await e.prepareTransaction(paymentTransaction, network, feeData, BigInt(overpayMultiplier));

      // calculating fees
      console.log('feeData=', feeData);

      console.log('lastBaseFeePerGas=', baseFee.toString());
      console.log('feeData.maxFeePerGas=', feeData.maxFeePerGas?.toString());
      console.log('feeData.maxPriorityFeePerGas=', feeData.maxPriorityFeePerGas?.toString());
      console.log('feeData.gasPrice=', feeData.gasPrice?.toString());
      console.log('prepared.gasLimit=', prepared.gasLimit?.toString());

      const calculatedMinFee = e.calculateMinFee(baseFee, prepared);
      const calculatedMaxFee = e.calculateMaxFee(prepared);

      setFees(calculatedMinFee);
      setMaxFees(calculatedMaxFee);

      console.log('calculatedFee=', calculatedMinFee);
      console.log('calculatedMaxFee=', calculatedMaxFee);

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
      const bytes = await e.signTransaction(prepared, decrypted, accountNumber);
      setBytes(bytes);
    } catch (error: any) {
      console.error(error.message);
      setError(error.message);
    } finally {
      setIsPreparing(false);
    }
  };

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
            Available balance: {balance ? formatBalance(balance, getDecimalsByNetwork(network)) : ''} {getTickerByNetwork(network)}
          </span>
        </div>
      </div>

      <br />
      <div style={{ width: '100%' }}>
        {fees && maxFees ? (
          <div style={{ color: 'gray', width: '100%', marginBottom: '15px' }}>
            <span style={{ fontSize: 16 }}>
              Fees between {formatBalance(fees, getDecimalsByNetwork(network))} {getTickerByNetwork(network)} and {formatBalance(maxFees, getDecimalsByNetwork(network))} {getTickerByNetwork(network)}
            </span>
          </div>
        ) : null}

        {error ? (
          <div style={{ color: 'red', width: '100%', marginBottom: '15px' }}>
            <span style={{ fontSize: 16 }}>{error}</span>
          </div>
        ) : null}

        {isPreparing ? <span>loading...</span> : null}

        {!bytes && !isPreparing ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 20 }}>
            <table>
              <tbody>
                <tr>
                  <td>
                    <span style={{ color: 'gray', fontSize: '16px' }}>Fee priority:</span>
                  </td>
                  <td>
                    <SelectFeeSlider
                      defaultValue={overpayMultiplier}
                      onChange={(v) => {
                        setOverpayMultiplier(v);
                      }}
                    />
                  </td>
                  <td>
                    <span style={{ color: 'gray', fontSize: '16px' }}>{overpayMultiplier}x</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}

        {!isPreparing && !bytes ? (
          <WideButton data-testid="send-screen-send-button" onClick={prepareTransaction}>
            <SendIcon />
            Send
          </WideButton>
        ) : null}

        {bytes ? (
          <div>
            <HodlButton onHold={broadcastTransaction}>
              <SendIcon />
              Hold to confirm send
            </HodlButton>

            <button
              onClick={() => {
                setBytes('');
                setFees(undefined);
                setMaxFees(undefined);
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

export default SendEvm;
