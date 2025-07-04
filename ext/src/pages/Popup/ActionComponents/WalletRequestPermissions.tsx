import React from 'react';

import { DappPermissions, PermissionRequest } from '@shared/class/dapp-permissions';
import { LayerzStorage } from '../../../class/layerz-storage';
import { Messenger } from '../../../modules/messenger';
import { Button } from '../DesignSystem';

interface WalletRequestPermissionsArgs {
  params: any[];
  id: number;
  from: string;
}

/**
 * This screen and such are basically single purpose popups that are supposed to get some sort of response from the user
 * and post data back via a message (there's a content script on the other end that will fulfill the promise for a web3 provider)
 */
export function WalletRequestPermissions(args: WalletRequestPermissionsArgs) {
  const onAllowClick = async () => {
    try {
      const id = args.id;
      const from = args.from;

      const permissions: PermissionRequest[] = args.params;

      const dp = new DappPermissions(String(from), LayerzStorage);
      const response = await dp.addPermissions(permissions[0]);
      await Messenger.sendResponseToActiveTabsFromPopupToContentScript({ for: 'webpage', id, response });
    } catch (error: any) {
      alert(error.message);
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 100)); // propagate
      window.close();
    }
  };

  const onDenyClick = async () => {
    const id = args.id;
    await Messenger.sendResponseToActiveTabsFromPopupToContentScript({
      for: 'webpage',
      id,
      error: { code: 4001, message: 'User rejected the request.' },
    });
    await new Promise((resolve) => setTimeout(resolve, 100)); // propagate
    window.close();
  };

  const renderData = () => {
    const params = args.params;
    return (
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
    );
  };

  return (
    <>
      <h1>Choose account</h1>

      <span>
        Dapp <b>{args.from}</b> wants your permission for:
      </span>

      {renderData()}

      <div>
        <Button onClick={() => onAllowClick()}>Allow</Button>
        <Button onClick={() => onDenyClick()}>Deny</Button>
      </div>
    </>
  );
}
