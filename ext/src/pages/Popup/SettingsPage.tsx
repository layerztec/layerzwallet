import * as BlueElectrum from '@shared/blue_modules/BlueElectrum';
import { HDSegwitBech32Wallet } from '@shared/class/wallets/hd-segwit-bech32-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { EStep, InitializationContext } from '@shared/hooks/InitializationContext';
import React, { useContext } from 'react';
import { useNavigate } from 'react-router';
import { Csprng } from '../../class/rng';
import { decrypt, encrypt } from '../../modules/encryption';
import { Button, Select } from './DesignSystem';
import { ThemedText } from '../../components/ThemedText';
import { SparkWallet } from '@shared/class/wallets/spark-wallet';

const pck = require('../../../package.json');

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { setStep } = useContext(InitializationContext);
  const { accountNumber, setAccountNumber } = useContext(AccountNumberContext);
  const assert = (condition: boolean, message: string) => {
    if (!condition) throw new Error('Assertion failed: ' + message);
  };

  const log = async (text: string) => {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = text;
    document.getElementById('messages')?.appendChild(messageDiv);
    await new Promise((resolve) => setTimeout(resolve, 100)); // sleep to propagate
  };

  const setSelectedAccount = (value: string) => {
    console.log(typeof value, value);
    setAccountNumber(parseInt(value));
  };

  return (
    <div>
      <ThemedText type="headline">Settings</ThemedText>

      <div style={{ textAlign: 'left', fontSize: '16px' }}>
        <ThemedText>Switch account:</ThemedText>
        <div style={{ marginBottom: '20px', marginTop: '5px' }}>
          <Select value={accountNumber} id="account-select" onChange={(e) => setSelectedAccount(e.target.value)}>
            <option value={0}>Account 0</option>
            <option value={1}>Account 1</option>
            <option value={2}>Account 2</option>
            <option value={3}>Account 3</option>
            <option value={4}>Account 4</option>
          </Select>
        </div>
      </div>

      <div style={{ fontSize: '12px' }}>
        <ThemedText>{pck.name + ' v' + pck.version}</ThemedText>
      </div>

      <a href="https://github.com/layerztec/bugtracker/issues" target="_blank" rel="noopener noreferrer">
        <ThemedText type="link">Bugtracker</ThemedText>
      </a>

      <br />
      <hr />
      <br />

      <Button
        onClick={async () => {
          await log('starting...');
          try {
            const w = new SparkWallet();
            w.setSecret('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
            await w.init();
            assert(
              (await w.getOffchainReceiveAddress()) === 'sp1pgss9qfk8ygtphqqzkj2yhn43k3s7r3g8z822ffvpcm38ym094800574233rzd',
              'unexpected spark wallet getOffchainReceiveAddress(): ' + (await w.getOffchainReceiveAddress())
            );

            const data2encrypt = 'really long data string bla bla really long data string bla bla really long data string bla bla';
            const start = +new Date();
            const crypted = await encrypt(Csprng, data2encrypt, 'password', '53B63311-D2D5-4C62-9F7F-28F25447B825');
            const end = +new Date();
            console.log('encryption took', (end - start) / 1000, 'sec');
            const decrypted = await decrypt(crypted, 'password', '53B63311-D2D5-4C62-9F7F-28F25447B825');
            assert(decrypted === data2encrypt, 'decryption failed');

            if (!BlueElectrum.mainConnected) {
              await BlueElectrum.connectMain();
            }
            const balance = await BlueElectrum.getBalanceByAddress('3GCvDBAktgQQtsbN6x5DYiQCMmgZ9Yk8BK');
            assert(balance.confirmed === 51432, 'Incorrect balance from electrum');
            console.log('electrum response:', balance);

            await log('OK');
          } catch (err: any) {
            await log(err.message);
          }
        }}
      >
        test
      </Button>
      <span> </span>
      <Button
        onClick={async () => {
          await log('starting...');
          try {
            if (!BlueElectrum.mainConnected) {
              await BlueElectrum.connectMain();
            }

            const w = new HDSegwitBech32Wallet();
            w.setSecret('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
            await w.fetchBalance();
            await w.fetchTransactions();
            assert(w.getTransactions().length > 0, 'could not fetch transactions');

            await log('OK');
          } catch (err: any) {
            await log(err.message);
          } finally {
            BlueElectrum.forceDisconnect();
          }
        }}
      >
        check HD wallet
      </Button>
      <span> </span>

      <Button
        onClick={async () => {
          chrome.storage.local.clear();
          localStorage.clear();
          setAccountNumber(-1); // to notify change
          // alert('done!');
          navigate('/');
          setStep(EStep.INTRO);
        }}
      >
        Clear storage
      </Button>

      <div id="messages" data-testid="messages"></div>
    </div>
  );
};

export default SettingsPage;
