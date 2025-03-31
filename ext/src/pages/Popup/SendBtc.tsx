import assert from 'assert';
import BigNumber from 'bignumber.js';
import * as bip21 from 'bip21';
import { Scan, SendIcon } from 'lucide-react';
import { default as React, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as BlueElectrum from '@shared/blue_modules/BlueElectrum';
import { TFeeEstimate } from '@shared/blue_modules/BlueElectrum';
import { HDSegwitBech32Wallet } from '@shared/class/wallets/hd-segwit-bech32-wallet';
import { CreateTransactionTarget, CreateTransactionUtxo } from '@shared/class/wallets/types';
import { DEFAULT_NETWORK } from '@shared/config';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { AskPasswordContext } from '../../hooks/AskPasswordContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { ScanQrContext } from '../../hooks/ScanQrContext';
import { useBalance } from '@shared/hooks/useBalance';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { BackgroundCaller } from '../../modules/background-caller';
import { getDeviceID } from '@shared/modules/device-id';
import { decrypt } from '../../modules/encryption';
import { Button, HodlButton, Input, Modal, RadioButton, WideButton } from './DesignSystem';
import ClipboardBackdoor from './components/ClipboardBackdoor';
import { formatBalance } from '@shared/modules/string-utils';
import { SecureStorage } from '../../class/secure-storage';
import { ENCRYPTED_PREFIX, STORAGE_KEY_MNEMONIC } from '@shared/types/IStorage';
import { LayerzStorage } from '../../class/layerz-storage';
import { Csprng } from '../../class/rng';

type TFeeRateOptions = { [rate: number]: number };

const withRetry = async <T,>(fn: () => Promise<T>, maxAttempts: number = 10, backoffMs: number = 1000): Promise<T> => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, backoffMs * attempt)); // Exponential backoff
    }
  }
  throw new Error('Should not reach here');
};

const SendBtc: React.FC = () => {
  const { scanQr } = useContext(ScanQrContext);
  const navigate = useNavigate();
  const [toAddress, setToAddress] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isPreparing, setIsPreparing] = useState<boolean>(false);
  const [isPrepared, setIsPrepared] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [customFeeRate, setCustomFeeRate] = useState<number | undefined>(); // fee rate that user selected
  const [estimateFees, setEstimateFees] = useState<undefined | TFeeEstimate>(); // estimated fees that we are loading from electrum
  const [sendData, setSendData] = useState<undefined | { utxos: CreateTransactionUtxo[]; changeAddress: string }>(undefined);
  const [txhex, setTxhex] = useState<string>('');
  const [actualFee, setActualFee] = useState<number>();
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { askPassword } = useContext(AskPasswordContext);
  const { balance } = useBalance(network ?? DEFAULT_NETWORK, accountNumber, BackgroundCaller);
  const [showFeeModal, setShowFeeModal] = useState(false);

  const feeRate = useMemo(() => {
    if (customFeeRate !== undefined) return customFeeRate;
    if (estimateFees) return estimateFees.medium;
    return 1;
  }, [customFeeRate, estimateFees]);

  // for each value from estimateFees we calculate the actual fee for the transaction
  const feeRateOptions: TFeeRateOptions = useMemo(() => {
    if (!sendData?.utxos) {
      return {};
    }
    const options = new Set<number>([feeRate]);
    if (estimateFees) {
      options.add(estimateFees.slow);
      options.add(estimateFees.medium);
      options.add(estimateFees.fast);
    }

    // construct targets, if something goes wrong, we will try to construct a transaction with minimum amount
    const satValueBN = new BigNumber(parseFloat(amount));
    const satValue = satValueBN.multipliedBy(new BigNumber(10).pow(getDecimalsByNetwork(network))).toNumber();
    const targets: CreateTransactionTarget[] = [
      {
        address: new HDSegwitBech32Wallet().isAddressValid(toAddress) ? toAddress : '36JxaUrpDzkEerkTf1FzwHNE1Hb7cCjgJV',
        value: Number.isNaN(satValue) ? 546 : satValue,
      },
    ];

    // for each fee rate, we try to construct a transaction and calculate the fee
    const result: { [key: number]: number } = {};
    Array.from(options).forEach((v) => {
      try {
        const tempWallet = new HDSegwitBech32Wallet();
        const { fee } = tempWallet.coinselect(sendData.utxos, targets, v);
        result[v] = fee;
      } catch (e: any) {
        if (e.message.includes('Not enough')) {
          // if we don't have enough funds, construct maximum possible transaction
          const targets2 = targets.map((t, index) => (index > 0 ? { ...t, value: 546 } : { address: t.address }));
          try {
            const tempWallet = new HDSegwitBech32Wallet();
            const { fee } = tempWallet.coinselect(sendData.utxos, targets2, v);
            result[v] = fee;
          } catch (e) {}
        }
      }
    });

    return result;
  }, [feeRate, estimateFees, sendData?.utxos, amount, toAddress, network]);

  useEffect(() => {
    (async () => {
      try {
        await withRetry(async () => {
          console.log('fetching estimateFees...');
          if (!BlueElectrum.mainConnected) {
            await BlueElectrum.connectMain();
          }
          const r = await BlueElectrum.estimateFees();
          console.log('...done fetching estimateFees!');
          setEstimateFees(r);
        });
      } catch (e: any) {
        console.log('Failed to fetch fees after retries', e);
        setError('Failed to load fee estimates');
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await withRetry(async () => {
          console.log('fetching getBtcSendData...');
          const r = await BackgroundCaller.getBtcSendData(accountNumber);
          console.log('...done fetching getBtcSendData!');
          setSendData(r);
        });
      } catch (e: any) {
        console.log('Failed to fetch UTXOs after retries', e);
        setError('Failed to load UTXOs');
      }
    })();
  }, [accountNumber]);

  const actualSend = async () => {
    try {
      if (!BlueElectrum.mainConnected) {
        await BlueElectrum.connectMain();
      }
      const result = await BlueElectrum.broadcastV2(txhex);
      if (!result) {
        throw new Error('Transaction failed');
      }

      setIsSuccess(true);
    } catch (error: any) {
      setError(error.message);
    }
  };

  const prepareTransaction = async () => {
    const w = new HDSegwitBech32Wallet();
    setIsPreparing(true);
    setError('');
    try {
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
        w.setSecret(decrypted);
        w.setDerivationPath(`m/84'/0'/${accountNumber}'`);
      } catch (_) {
        // only catching and re-throwing to change the error message. probably would be better to
        // make a separate place to interpret errors and display the appropriate ones
        throw new Error('Incorrect password');
      }

      assert(sendData?.utxos, 'internal error: utxo not loaded');
      assert(sendData?.changeAddress, 'internal error: change address not loaded');

      // construct transaction
      const targets: CreateTransactionTarget[] = [
        {
          address: toAddress,
          value: Number(satValue),
        },
      ];
      const { tx, fee } = w.createTransaction(sendData.utxos, targets, feeRate, sendData.changeAddress);
      assert(tx, 'Internal error: Wallet.createTransaction failed');
      setTxhex(tx.toHex());
      setActualFee(fee);
      setIsPrepared(true);
    } catch (error: any) {
      console.error(error.message);
      setError(error.message);
    } finally {
      setIsPreparing(false);
    }
  };

  const handleChangeCustom = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomFeeRate(Number(e.target.value));
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
            onClick={async () => {
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

        {isPreparing ? <span>loading...</span> : null}

        {!isPreparing && !isPrepared ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
            <span style={{ color: 'gray', fontSize: '16px' }}>
              Network Fee: {feeRate} sats/vbyte{feeRateOptions[feeRate] && <span> ({feeRateOptions[feeRate]} sats)</span>}
            </span>
            <Button data-testid="change-fee-button" onClick={() => setShowFeeModal(true)}>
              Change Fee
            </Button>
          </div>
        ) : null}

        {showFeeModal && (
          <Modal onClose={() => setShowFeeModal(false)}>
            <div style={{ padding: '20px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Select Network Fee</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {estimateFees && (
                  <>
                    <RadioButton
                      data-testid="fee-economy-radio"
                      label={`Economy (${estimateFees.slow} sat/vbyte)` + (feeRateOptions[estimateFees.slow] ? ` ≈ ${feeRateOptions[estimateFees.slow]} sats` : '')}
                      name="feeOption"
                      checked={feeRate === estimateFees.slow}
                      onChange={() => setCustomFeeRate(estimateFees.slow)}
                    />

                    <RadioButton
                      data-testid="fee-standard-radio"
                      label={`Standard (${estimateFees.medium} sat/vbyte)` + (feeRateOptions[estimateFees.medium] ? ` ≈ ${feeRateOptions[estimateFees.medium]} sats` : '')}
                      name="feeOption"
                      checked={feeRate === estimateFees.medium}
                      onChange={() => setCustomFeeRate(estimateFees.medium)}
                    />

                    <RadioButton
                      data-testid="fee-priority-radio"
                      label={`Priority (${estimateFees.fast} sat/vbyte)` + (feeRateOptions[estimateFees.fast] ? ` ≈ ${feeRateOptions[estimateFees.fast]} sats` : '')}
                      name="feeOption"
                      checked={feeRate === estimateFees.fast}
                      onChange={() => setCustomFeeRate(estimateFees.fast)}
                    />
                  </>
                )}

                <div style={{ marginTop: '10px' }}>
                  <div style={{ marginBottom: '5px' }}>Custom (sat/vbyte)</div>
                  <Input data-testid="custom-fee-input" type="number" value={feeRate} min={1} onChange={handleChangeCustom} style={{ width: '100px' }} />
                </div>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <Button data-testid="fee-done-button" disabled={!customFeeRate} onClick={() => setShowFeeModal(false)}>
                  Done
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {!isPreparing && !isPrepared ? (
          <WideButton data-testid="send-screen-send-button" onClick={prepareTransaction} disabled={!sendData}>
            <SendIcon />
            Send
          </WideButton>
        ) : null}

        {isPrepared ? (
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
                setIsPreparing(false);
                setIsPrepared(false);
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

export default SendBtc;
