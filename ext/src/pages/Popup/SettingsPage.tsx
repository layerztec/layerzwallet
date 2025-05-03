import * as BlueElectrum from '@shared/blue_modules/BlueElectrum';
import { HDSegwitBech32Wallet } from '@shared/class/wallets/hd-segwit-bech32-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { EStep, InitializationContext } from '@shared/hooks/InitializationContext';
import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Csprng } from '../../class/rng';
import { decrypt, encrypt } from '../../modules/encryption';
import { Button, Select, Card, Text, Container } from './DesignSystem';
import { getCurrentTheme, LayerzColors } from './theme';

const pck = require('../../../package.json');

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { setStep } = useContext(InitializationContext);
  const { accountNumber, setAccountNumber } = useContext(AccountNumberContext);
  const theme = getCurrentTheme();

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
    setAccountNumber(parseInt(value));
  };

  // Account options for the Select component
  const accountOptions = [
    { value: '0', label: 'Account 0' },
    { value: '1', label: 'Account 1' },
    { value: '2', label: 'Account 2' },
    { value: '3', label: 'Account 3' },
    { value: '4', label: 'Account 4' },
  ];

  return (
    <Container
      style={{
        padding: '20px',
        backgroundColor: LayerzColors[theme].background,
        height: '100%',
      }}
    >
      <Text
        variant="heading"
        style={{
          marginBottom: '24px',
        }}
      >
        Settings
      </Text>

      <Card
        style={{
          marginBottom: '20px',
          width: '100%',
        }}
      >
        <Text
          variant="subtitle"
          style={{
            marginBottom: '16px',
          }}
        >
          Account Settings
        </Text>

        <Select value={accountNumber.toString()} onChange={setSelectedAccount} options={accountOptions} label="Switch account:" fullWidth />
      </Card>

      <Card
        style={{
          marginBottom: '20px',
          width: '100%',
        }}
      >
        <Text
          variant="subtitle"
          style={{
            marginBottom: '16px',
          }}
        >
          Developer Options
        </Text>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          <Button
            style={{ backgroundColor: LayerzColors[theme].secondary }}
            onClick={async () => {
              await log('starting...');
              try {
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
            Test Encryption
          </Button>

          <Button
            style={{ backgroundColor: LayerzColors[theme].secondary }}
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
            Check HD Wallet
          </Button>

          <Button
            style={{ backgroundColor: LayerzColors[theme].error }}
            onClick={async () => {
              chrome.storage.local.clear();
              localStorage.clear();
              setAccountNumber(-1); // to notify change
              // alert('done!');
              navigate('/');
              setStep(EStep.INTRO);
            }}
          >
            Clear Storage
          </Button>
        </div>

        <div
          id="messages"
          data-testid="messages"
          style={{
            maxHeight: '150px',
            overflow: 'auto',
            padding: '8px',
            backgroundColor: LayerzColors[theme].surfaceBackground,
            borderRadius: '4px',
            fontSize: '12px',
            marginTop: '16px',
          }}
        ></div>
      </Card>

      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <Text variant="caption" style={{ color: LayerzColors[theme].textSecondary }}>
          {pck.name + ' v' + pck.version}
        </Text>
        <div style={{ marginTop: '8px' }}>
          <a
            href="https://github.com/layerztec/bugtracker/issues"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: LayerzColors[theme].primary,
              textDecoration: 'underline',
              fontSize: '14px',
            }}
          >
            Report a bug
          </a>
        </div>
      </div>

      <Button style={{ marginTop: '24px', width: '100%' }} onClick={() => navigate('/')}>
        Back to Home
      </Button>
    </Container>
  );
};

export default SettingsPage;
