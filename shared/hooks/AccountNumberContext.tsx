import React, { createContext, ReactNode, useEffect, useState } from 'react';

import { DEFAULT_NETWORK } from '../config';
import { IBackgroundCaller } from '../types/IBackgroundCaller';
import { IMessenger } from '../modules/messenger';
import { Networks } from '../types/networks';
import { STORAGE_SELECTED_NETWORK } from './NetworkContext';
import { IStorage } from '../types/IStorage';

type AccountNumber = number;

interface IAccountNumberContext {
  accountNumber: AccountNumber;
  setAccountNumber: React.Dispatch<React.SetStateAction<AccountNumber>>;
}

export const AccountNumberContext = createContext<IAccountNumberContext>({
  accountNumber: 0,
  setAccountNumber: () => {
    throw new Error('AccountNumberContext.setAccountNumber(): This should never happen');
  },
});

export const STORAGE_SELECTED_ACCOUNT_NUMBER = 'STORAGE_SELECTED_ACCOUNT_NUMBER';

interface AccountNumberContextProviderProps {
  children: ReactNode;
  storage: IStorage;
  backgroundCaller: IBackgroundCaller;
  messenger: IMessenger;
}

export const AccountNumberContextProvider: React.FC<AccountNumberContextProviderProps> = (props) => {
  const [accountNumber, setAccountNumber] = useState<AccountNumber>(0);

  // initial load:
  useEffect(() => {
    (async () => {
      await props.backgroundCaller.log('loading selected account...');
      const response = await props.storage.getItem(STORAGE_SELECTED_ACCOUNT_NUMBER);
      setAccountNumber(Number(response) || 0);
    })();
  }, [props.storage, props.backgroundCaller]);

  const setAccountNumberOverload = (value: ((prevState: AccountNumber) => AccountNumber) | AccountNumber) => {
    if (value instanceof Function) {
      setAccountNumber(value(accountNumber)); // unsure
    } else {
      // -1 is triggered in settings when data is removed
      if (value === -1) {
        value = 0;
      }
      props.backgroundCaller.log('changing selected account to: ' + value);
      props.storage.setItem(STORAGE_SELECTED_ACCOUNT_NUMBER, String(value));
      setAccountNumber(value);

      // triggering event for any connected Dapp:
      (async () => {
        try {
          const response = (await props.storage.getItem(STORAGE_SELECTED_NETWORK)) as Networks;
          const addressResponse = await props.backgroundCaller.getAddress(response || DEFAULT_NETWORK, accountNumber);
          await props.messenger.sendEventCallbackFromPopupToContentScript({
            for: 'webpage',
            event: 'accountsChanged',
            type: 'eventCallback',
            arg: [addressResponse],
          });
        } catch (error: any) {
          console.error(error.message);
        }
      })();
    }
  };

  return <AccountNumberContext.Provider value={{ accountNumber, setAccountNumber: setAccountNumberOverload }}>{props.children}</AccountNumberContext.Provider>;
};
