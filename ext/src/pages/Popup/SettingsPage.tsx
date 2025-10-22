import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { BackgroundCaller } from '../../modules/background-caller';
import * as BlueElectrum from '@shared/blue_modules/BlueElectrum';
import { HDSegwitBech32Wallet } from '@shared/class/wallets/hd-segwit-bech32-wallet';
import { SparkWallet } from '@shared/class/wallets/spark-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { EStep, InitializationContext } from '@shared/hooks/InitializationContext';
import { SETTINGS_CONFIG } from '@shared/hooks/SettingsContext';
import { useSettings } from '@shared/hooks/useSettings';
import { Csprng } from '../../class/rng';
import { ThemedText } from '../../components/ThemedText';
import { decrypt, encrypt } from '../../modules/encryption';
import { Button, Select } from './DesignSystem';
import Bugsnag from '@bugsnag/js';
import { getDeviceID } from '@shared/modules/device-id';
import { LayerzStorage } from '../../class/layerz-storage';
import { isPlaywrightMode } from '../../utils/playwright-detection';
import { BUGSNAG_API_KEY } from './bugsnag-config';

const pck = require('../../../package.json');

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { setStep } = useContext(InitializationContext);
  const { accountNumber, setAccountNumber } = useContext(AccountNumberContext);
  const { settings, updateSetting } = useSettings();
  const [deviceId, setDeviceId] = useState<string>('');
  const hasBugsnag = Boolean(BUGSNAG_API_KEY);

  useEffect(() => {
    if (!hasBugsnag) {
      setDeviceId('');
      if (Bugsnag.isStarted()) {
        Bugsnag.clearMetadata('device');
        Bugsnag.setUser();
      }
      return;
    }

    if (!isPlaywrightMode()) {
      getDeviceID(LayerzStorage, Csprng)
        .then((id) => {
          setDeviceId(id);
          if (Bugsnag.isStarted()) {
            Bugsnag.setUser(id, undefined, undefined);
            Bugsnag.addMetadata('device', { id, source: 'shared-module' });
          }
        })
        .catch((error) => {
          console.debug('Device identifier not available:', error);
          setDeviceId('');
          if (Bugsnag.isStarted()) {
            Bugsnag.clearMetadata('device');
          }
        });
    } else {
      console.debug('Device ID disabled in Playwright test mode');
      setDeviceId('');
      if (Bugsnag.isStarted()) {
        Bugsnag.clearMetadata('device');
      }
    }
  }, [hasBugsnag]);

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

  const handleDeviceIdClick = async () => {
    if (!hasBugsnag || !Bugsnag.isStarted()) {
      console.warn('[DeviceIdClick] Bugsnag not configured — skipping device ID test');
      return;
    }

    if (deviceId) {
      try {
        const testError = new Error(`Test error from device: ${deviceId}`);

        Bugsnag.notify(testError, (event) => {
          event.addMetadata('test', {
            deviceId: deviceId,
            timestamp: new Date().toISOString(),
            testType: 'manual_trigger',
          });
        });

        await navigator.clipboard.writeText(deviceId);

        alert(`Test error sent and ID copied to clipboard!\n\nID: ${deviceId}`);
      } catch (error) {
        console.error('[DeviceIdClick] Error sending to Bugsnag:', error);
        console.error('[DeviceIdClick] Error stack:', error instanceof Error ? error.stack : 'no stack');
        alert(`Failed to send test error: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      console.warn('[DeviceIdClick] No device ID available');
    }
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

      {deviceId && hasBugsnag && (
        <>
          <Button onClick={handleDeviceIdClick}>Device ID: {deviceId}</Button>
          <span> </span>
        </>
      )}

      <div id="messages" data-testid="messages"></div>
    </div>
  );
};

export default SettingsPage;
