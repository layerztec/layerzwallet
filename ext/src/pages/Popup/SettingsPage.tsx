import React, { useContext, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { BackgroundCaller } from '../../modules/background-caller';
import * as BlueElectrum from '@shared/blue_modules/BlueElectrum';
import { HDSegwitBech32Wallet } from '@shared/class/wallets/hd-segwit-bech32-wallet';
import { RgbWallet } from '@shared/class/wallets/rgb-wallet';
import { SparkWallet } from '@shared/class/wallets/spark-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { EStep, InitializationContext } from '@shared/hooks/InitializationContext';
import { SETTINGS_CONFIG } from '@shared/hooks/SettingsContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import { useSettings } from '@shared/hooks/useSettings';
import { NETWORK_RGB, NETWORK_RGB_TESTNET } from '@shared/types/networks';
import { Csprng } from '../../class/rng';
import { ThemedText } from '../../components/ThemedText';
import { decrypt, encrypt } from '../../modules/encryption';
import { exportRgbBackup, importRgbBackup } from '../../modules/rgb-adapter';
import { LayerzStorage } from '../../class/layerz-storage';
import { Button, Select } from './DesignSystem';

const pck = require('../../../package.json');

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { setStep } = useContext(InitializationContext);
  const { accountNumber, setAccountNumber } = useContext(AccountNumberContext);
  const { settings, updateSetting } = useSettings();
  const { network } = useContext(NetworkContext);
  const rgbFileInput = useRef<HTMLInputElement>(null);
  const [rgbBusy, setRgbBusy] = useState(false);

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

  const handleSettingChange = async (key: string, value: string | boolean) => {
    try {
      await updateSetting(key as any, value);
    } catch (error) {
      console.error('Error updating setting:', error);
    }
  };

  // Backup acts on the selected RGB network; from any other network, on RGB testnet.
  const rgbBackupTarget = async () => {
    const rgbNetwork = network === NETWORK_RGB ? NETWORK_RGB : NETWORK_RGB_TESTNET;
    const wallet = await BackgroundCaller.lazyInitWallet(rgbNetwork, 0);
    if (!(wallet instanceof RgbWallet)) throw new Error('RGB wallet is unavailable');
    return { wallet, mnemonic: wallet.getSecret(), sdkNetwork: rgbNetwork === NETWORK_RGB ? ('mainnet' as const) : ('testnet' as const) };
  };

  const handleExportRgbBackup = async () => {
    setRgbBusy(true);
    try {
      const { wallet, mnemonic, sdkNetwork } = await rgbBackupTarget();
      const bytes = await exportRgbBackup(wallet.getSdk(), mnemonic, sdkNetwork);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/octet-stream' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `layerz-rgb-${sdkNetwork}.rgbbackup`;
      a.click();
      URL.revokeObjectURL(url);
      await log('RGB backup file saved. Export again after every receive or send.');
    } catch (err: any) {
      await log('RGB backup export failed: ' + err.message);
    } finally {
      setRgbBusy(false);
    }
  };

  const handleImportRgbBackup = async (file: File | undefined) => {
    if (!file) return;
    setRgbBusy(true);
    try {
      const { wallet, mnemonic, sdkNetwork } = await rgbBackupTarget();
      if (!window.confirm(`Replace the RGB ${sdkNetwork} wallet state on this browser with "${file.name}"? The file must come from this same seed.`)) {
        setRgbBusy(false);
        return;
      }
      await importRgbBackup(wallet.getSdk(), mnemonic, sdkNetwork, new Uint8Array(await file.arrayBuffer()));
      window.alert('RGB backup restored.');
    } catch (err: any) {
      window.alert('RGB backup import failed, previous state kept: ' + err.message);
    }
    // The wallet's engine is disposed either way; start from a clean page.
    window.location.reload();
  };

  return (
    <div>
      <ThemedText type="headline">Settings</ThemedText>

      <div style={{ textAlign: 'left', fontSize: '16px' }}>
        <ThemedText>Switch pocket:</ThemedText>
        <div style={{ marginBottom: '20px', marginTop: '5px' }}>
          <Select value={accountNumber} id="account-select" onChange={(e) => setSelectedAccount(e.target.value)}>
            <option value={0}>Pocket 0</option>
            <option value={1}>Pocket 1</option>
            <option value={2}>Pocket 2</option>
            <option value={3}>Pocket 3</option>
            <option value={4}>Pocket 4</option>
          </Select>
        </div>
      </div>

      {/* App Settings Section */}
      <div style={{ textAlign: 'left', fontSize: '16px', marginBottom: '20px' }}>
        {Object.keys(SETTINGS_CONFIG).map((key) => {
          const config = SETTINGS_CONFIG[key as keyof typeof SETTINGS_CONFIG];
          const currentValue = settings[key as keyof typeof SETTINGS_CONFIG];

          return (
            <div key={key} style={{ marginBottom: '15px' }}>
              <ThemedText>{key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}:</ThemedText>
              <div style={{ marginTop: '5px' }}>
                <Select id={`setting-${key}`} value={currentValue} onChange={(e) => handleSettingChange(key, e.target.value)}>
                  {config.options.map((option: string) => (
                    <option key={option} value={option}>
                      {option === 'never' ? 'Never' : option === 'ON' ? 'On' : option === 'OFF' ? 'Off' : option.length === 2 ? option.toUpperCase() : option.charAt(0).toUpperCase() + option.slice(1)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: '12px' }}>
        <ThemedText>{pck.name + ' v' + pck.version}</ThemedText>
      </div>

      <br />
      <hr />
      <br />

      <Button
        onClick={async () => {
          await log('starting...');
          try {
            const w = new SparkWallet();
            w.setSecret('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
            await w.init(LayerzStorage);
            assert(
              (await w.getOffchainReceiveAddress()) === 'spark1pgss9qfk8ygtphqqzkj2yhn43k3s7r3g8z822ffvpcm38ym094800574x5numh',
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
          await BackgroundCaller.clear();
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

      <Button onClick={() => navigate('/seed-backup')} style={{ marginBottom: '10px' }}>
        Seed Backup
      </Button>
      <span> </span>

      <Button onClick={handleExportRgbBackup} disabled={rgbBusy} data-testid="export-rgb-backup" style={{ marginBottom: '10px' }}>
        Export RGB backup file
      </Button>
      <span> </span>
      <Button onClick={() => rgbFileInput.current?.click()} disabled={rgbBusy} data-testid="import-rgb-backup" style={{ marginBottom: '10px' }}>
        Import RGB backup file
      </Button>
      <input ref={rgbFileInput} type="file" data-testid="import-rgb-backup-input" style={{ display: 'none' }} onChange={(e) => handleImportRgbBackup(e.target.files?.[0])} />

      <div id="messages" data-testid="messages"></div>
    </div>
  );
};

export default SettingsPage;
