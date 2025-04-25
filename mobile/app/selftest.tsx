import { Button, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { EvmWallet } from '@shared/class/evm-wallet';
import { HDSegwitBech32Wallet } from '@shared/class/wallets/hd-segwit-bech32-wallet';
import { decrypt, encrypt } from '../src/modules/encryption';
import assert from 'assert';
import { useState } from 'react';

import { Csprng } from '@/src/class/rng';
import * as BlueElectrum from '@shared/blue_modules/BlueElectrum';

export default function TabThreeScreen() {
  const [testState, setTestState] = useState<'not_started' | 'running' | 'ok' | 'error'>('not_started');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleSelfTest = async () => {
    try {
      setTestState('running');
      await new Promise((resolve) => setTimeout(resolve, 200)); // propagate

      // testing evm:
      const xpub = EvmWallet.mnemonicToXpub('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
      assert.strictEqual(xpub, 'xpub6EF8jXqFeFEW5bwMU7RpQtHkzE4KJxcqJtvkCjJumzW8CPpacXkb92ek4WzLQXjL93HycJwTPUAcuNxCqFPKKU5m5Z2Vq4nCyh5CyPeBFFr');
      assert.strictEqual(EvmWallet.xpubToAddress(xpub, 0), '0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
      assert.strictEqual(EvmWallet.xpubToAddress(xpub, 1), '0x6Fac4D18c912343BF86fa7049364Dd4E424Ab9C0');

      // testing btc:
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const hd = new HDSegwitBech32Wallet();
      hd.setSecret(mnemonic);
      assert.strictEqual(true, hd.validateMnemonic());
      assert.strictEqual('zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs', hd.getXpub());
      assert.strictEqual(hd._getExternalWIFByIndex(0), 'KyZpNDKnfs94vbrwhJneDi77V6jF64PWPF8x5cdJb8ifgg2DUc9d');
      assert.strictEqual(hd._getExternalWIFByIndex(1), 'Kxpf5b8p3qX56DKEe5NqWbNUP9MnqoRFzZwHRtsFqhzuvUJsYZCy');
      assert.strictEqual(hd._getInternalWIFByIndex(0), 'KxuoxufJL5csa1Wieb2kp29VNdn92Us8CoaUG3aGtPtcF3AzeXvF');
      assert.strictEqual(hd._getExternalAddressByIndex(0), 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu');
      assert.strictEqual(hd._getExternalAddressByIndex(1), 'bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g');
      assert.strictEqual(hd._getInternalAddressByIndex(0), 'bc1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el');

      // testing buffer (the most problematic dep):
      const buffer = Buffer.from('ffff', 'hex');
      assert.strictEqual(buffer.toString('hex'), 'ffff');

      // testing encryption:
      const data2encrypt = 'really long data string bla bla really long data string bla bla really long data string bla bla';
      const start = Date.now();
      const crypted = await encrypt(Csprng, data2encrypt, 'password', '53B63311-D2D5-4C62-9F7F-28F25447B825');
      const end = Date.now();
      console.log(`encryption took ${end - start}ms`);
      const decrypted = await decrypt(crypted, 'password', '53B63311-D2D5-4C62-9F7F-28F25447B825');
      assert(decrypted === data2encrypt, 'decryption failed');

      // testing electrum:
      if (!BlueElectrum.mainConnected) {
        await BlueElectrum.connectMain();
      }
      const balance = await BlueElectrum.getBalanceByAddress('3GCvDBAktgQQtsbN6x5DYiQCMmgZ9Yk8BK');
      assert.strictEqual(balance.confirmed, 51432, 'Incorrect balance from electrum');

      setTestState('ok');
    } catch (error: any) {
      setErrorMessage(error.message);
      setTestState('error');
    }
  };

  return (
    <View>
      {(() => {
        switch (testState) {
          case 'not_started':
            return <Button title={'Run Self Test!'} onPress={handleSelfTest} testID="SelfTestButton" />;
          case 'running':
            return <ThemedText>running</ThemedText>;
          case 'error':
            return <ThemedText>Error: {errorMessage}</ThemedText>;
          case 'ok':
            return <ThemedText>ok!</ThemedText>;
        }
      })()}
    </View>
  );
}
