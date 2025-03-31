import React, { useContext, useState } from 'react';

import { EvmWallet } from '@shared/class/evm-wallet';
import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { AskPasswordContext } from '../../../hooks/AskPasswordContext';
import { NetworkContext } from '@shared/hooks/NetworkContext';

import { BackgroundCaller } from '../../../modules/background-caller';
import { Messenger } from '@shared/modules/messenger';
import { Button, HodlButton, SelectFeeSlider } from '../DesignSystem';
import assert from 'assert';
import { decrypt } from '../../../modules/encryption';
import { getDeviceID } from '@shared/modules/device-id';
import { StringNumber } from '@shared/types/string-number';
import { getDecimalsByNetwork, getTickerByNetwork } from '@shared/models/network-getters';
import { SendIcon } from 'lucide-react';
import { formatBalance, hexToDec } from '@shared/modules/string-utils';
import { SecureStorage } from '../../../class/secure-storage';
import { ENCRYPTED_PREFIX, STORAGE_KEY_MNEMONIC } from '@shared/types/IStorage';
import { LayerzStorage } from '../../../class/layerz-storage';
import { Csprng } from '../../../class/rng';

interface SendTransactionArgs {
  params: any[];
  id: string;
  from: string;
}

/**
 * This screen and such are basically single purpose popups that are supposed to get some sort of response from the user
 * and post data back via a message (there's a content script on the other end that will fulfill the promise for a web3 provider)
 */
export function SendTransaction(args: SendTransactionArgs) {
  const { network } = useContext(NetworkContext);
  const { accountNumber } = useContext(AccountNumberContext);
  const { askPassword } = useContext(AskPasswordContext);
  const [minFees, setMinFees] = useState<StringNumber>(); // min fees user will have to pay for the transaction
  const [maxFees, setMaxFees] = useState<StringNumber>(); // max fees user will have to pay for the transaction
  const [bytes, setBytes] = useState<string>(''); // txhex ready to broadcast
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [overpayMultiplier, setOverpayMultiplier] = useState<number>(1);

  const onAllowClick = async () => {
    const id = args.id;

    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 100)); // propagate

    try {
      const tx = getParamsTx();
      if (tx) {
        const e = new EvmWallet();
        const feeData = await e.getFeeData(network);
        let baseFee;
        try {
          baseFee = await e.getBaseFeePerGas(network);
        } catch (_) {
          baseFee = 0n;
        }
        const prepared = await e.prepareTransaction(tx, network, feeData, BigInt(overpayMultiplier));

        console.log('prepared transaction: ', prepared);

        // calculating fees
        console.log('feeData=', feeData);

        console.log('lastBaseFeePerGas=', baseFee.toString());
        console.log('feeData.maxFeePerGas=', feeData.maxFeePerGas?.toString());
        console.log('feeData.maxPriorityFeePerGas=', feeData.maxPriorityFeePerGas?.toString());
        console.log('feeData.gasPrice=', feeData.gasPrice?.toString());
        console.log('prepared.gasLimit=', prepared.gasLimit?.toString());
        console.log('prepared.value=', prepared.value);

        const calculatedMinFee = e.calculateMinFee(baseFee, prepared);
        const calculatedMaxFee = e.calculateMaxFee(prepared);

        setMinFees(calculatedMinFee);
        setMaxFees(calculatedMaxFee);

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
        BackgroundCaller.log('signed tx: ' + bytes);

        return;
      }

      // guard, we are not even supposed to display allow/deny buttons if we cant get params

      await Messenger.sendResponseToActiveTabsFromPopupToContentScript({
        for: 'webpage',
        id: Number(id),
        error: {
          code: 4902,
          message: 'Cant get params',
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 100)); // propagate
      window.close();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const onDenyClick = async () => {
    const id = args.id;
    await Messenger.sendResponseToActiveTabsFromPopupToContentScript({ for: 'webpage', id: Number(id), error: { code: 4001, message: 'User rejected the request.' } });

    await new Promise((resolve) => setTimeout(resolve, 100)); // propagate
    window.close();
  };

  const getParamsTx = (): any | undefined => {
    try {
      const json = args.params;
      return json?.[0];
    } catch (_) {
      return undefined;
    }
  };

  const renderParams = () => {
    const params = getParamsTx();
    const isSmartContractInteraction = params?.data; // probably also need to check length of data so its not just 0x0
    if (params) {
      return (
        <div>
          <textarea
            readOnly
            value={JSON.stringify(params, null, 2)}
            style={{
              width: '100%',
              height: '200px',
              fontFamily: 'monospace',
              fontSize: '14px',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              resize: 'none',
              overflowY: 'auto',
              backgroundColor: '#f5f5f5',
            }}
          />
          <div style={{ fontSize: '16px', paddingBottom: 5, paddingTop: 20, color: 'gray' }}>
            {params?.to ? <div>To: {params.to}</div> : null}
            {isSmartContractInteraction ? <div>(smart contract interaction)</div> : null}
            {params?.value && hexToDec(params?.value) > 0 ? (
              <div>
                Sending: {formatBalance(String(hexToDec(params?.value ?? 0)), getDecimalsByNetwork(network))} {getTickerByNetwork(network)}
              </div>
            ) : null}
          </div>
        </div>
      );
    } else {
      return <span style={{ fontSize: 14 }}>Error</span>;
    }
  };

  const broadcastTransaction = async () => {
    try {
      const id = args.id;
      console.log('broadcasting', bytes);
      const e = new EvmWallet();

      const txid = await e.broadcastTransaction(network, bytes);

      console.log('broadcasted:', txid);
      if (typeof txid !== 'string') {
        throw new Error('Broadcast error: ' + JSON.stringify(txid));
      }

      await Messenger.sendResponseToActiveTabsFromPopupToContentScript({
        for: 'webpage',
        id: Number(id),
        response: txid,
      });

      await new Promise((resolve) => setTimeout(resolve, 100)); // propagate
      window.close();
    } catch (error: any) {
      setError(error.message);
    }
  };

  return (
    <>
      <h1>Dapp wants to send transaction</h1>

      <span>{renderParams()}</span>

      {isLoading ? (
        <span>Loading...</span>
      ) : (
        <div>
          {minFees && maxFees ? (
            <div style={{ color: 'gray', width: '100%', marginBottom: '15px' }}>
              <span style={{ fontSize: 16 }}>
                Fees between {formatBalance(minFees, getDecimalsByNetwork(network))} {getTickerByNetwork(network)} and {formatBalance(maxFees, getDecimalsByNetwork(network))}{' '}
                {getTickerByNetwork(network)}
              </span>
            </div>
          ) : null}

          {!bytes ? (
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

          {!bytes ? (
            <span>
              <Button onClick={() => onAllowClick()}>Allow</Button>
              <Button onClick={() => onDenyClick()}>Deny</Button>
            </span>
          ) : null}

          {error ? (
            <div style={{ color: 'red', width: '100%', marginBottom: '15px' }}>
              <span style={{ fontSize: 16 }}>{error}</span>
            </div>
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
                  setMinFees(undefined);
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
      )}
    </>
  );
}
