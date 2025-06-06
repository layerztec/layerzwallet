import React, { useContext, useState } from 'react';

import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { AskPasswordContext } from '../../../hooks/AskPasswordContext';

import { BackgroundCaller } from '../../../modules/background-caller';
import { Messenger } from '@shared/modules/messenger';
import { Button } from '../DesignSystem';

interface SignTypedDataArgs {
  params: any[];
  id: string;
  from: string;
}

/**
 * This screen and such are basically single purpose popups that are supposed to get some sort of response from the user
 * and post data back via a message (there's a content script on the other end that will fulfill the promise for a web3 provider)
 */
export function EthSignTypedData(args: SignTypedDataArgs) {
  const { accountNumber } = useContext(AccountNumberContext);
  const { askPassword } = useContext(AskPasswordContext);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const onAllowClick = async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 100)); // propagate
    try {
      const params = args.params;
      let payload = '';
      if (Array.isArray(params)) {
        payload = params[1];
      }

      const password = await askPassword();
      const signedResponse = await BackgroundCaller.signTypedData(payload, accountNumber, password);

      if (!signedResponse.success) {
        throw new Error(signedResponse?.message ?? 'Signature error');
      }

      const id = args.id;
      await Messenger.sendResponseToActiveTabsFromPopupToContentScript({ for: 'webpage', id: Number(id), response: signedResponse.bytes });

      await new Promise((resolve) => setTimeout(resolve, 100)); // propagate
      window.close();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const onDenyClick = async () => {
    const id = args.id;
    await Messenger.sendResponseToActiveTabsFromPopupToContentScript({
      for: 'webpage',
      id: Number(id),
      error: { code: 4001, message: 'User rejected the request.' },
    });
    await new Promise((resolve) => setTimeout(resolve, 100)); // propagate
    window.close();
  };

  const renderParams = () => {
    return (
      <textarea
        readOnly
        value={JSON.stringify(args.params, null, 2)}
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
    );
  };

  return (
    <>
      <h1>Signature request</h1>

      <span>{renderParams()}</span>

      {isLoading ? (
        <span>Loading...</span>
      ) : (
        <div>
          <Button onClick={() => onAllowClick()}>Allow</Button>
          <Button onClick={() => onDenyClick()}>Deny</Button>
        </div>
      )}
    </>
  );
}
