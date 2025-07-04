import React, { useContext, useEffect, useState } from 'react';

import { AccountNumberContext } from '@shared/hooks/AccountNumberContext';
import { BackgroundCaller } from '../../../modules/background-caller';
import { Messenger } from '@shared/modules/messenger';
import { AddressBubble, Button } from '../DesignSystem';
import { NETWORK_ROOTSTOCK } from '@shared/types/networks';

interface EthRequestAccountsArgs {
  params: any[];
  id: number;
  from: string;
}

/**
 * This screen and such are basically single purpose popups that are supposed to get some sort of response from the user
 * and post data back via a message (there's a content script on the other end that will fulfill the promise for a web3 provider)
 */
export function EthRequestAccounts(args: EthRequestAccountsArgs) {
  const [address, setAddress] = useState<string>('');
  const { accountNumber } = useContext(AccountNumberContext);

  useEffect(() => {
    (async () => {
      const addressResponse = await BackgroundCaller.getAddress(NETWORK_ROOTSTOCK, accountNumber); // dapp is interested in EVM address specifically, NOT of currently-selected network
      if (addressResponse) setAddress(addressResponse);
    })();
  }, [accountNumber]);

  const onAllowClick = async () => {
    const id = args.id;
    const from = args.from;
    if (from) {
      // whitelisting this Dapp
      await BackgroundCaller.whitelistDapp(from);
    }
    await Messenger.sendResponseToActiveTabsFromPopupToContentScript({ for: 'webpage', id, response: [address] });
    await new Promise((resolve) => setTimeout(resolve, 100)); // propagate
    window.close();
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

  return (
    <>
      <span>
        Dapp <b>{args.from}</b> wants your permission to access your account
      </span>

      <AddressBubble address={address} showCopyButton={false} />

      <div>
        <Button onClick={() => onAllowClick()}>Allow</Button>
        <span> </span>
        <Button onClick={() => onDenyClick()}>Deny</Button>
      </div>
    </>
  );
}
